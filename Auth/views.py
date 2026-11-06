"""
Authentication Views
====================
JWT-based authentication endpoints with role-based access control.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import logout
from django.contrib.auth.models import User
from django.core.management import call_command
from io import StringIO

from HumanResources.models import Officer

from .models import Role, UserProfile, SystemConfig
from .serializers import (
    AvailableOfficerSerializer,
    CustomTokenObtainPairSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
)
from .utils import get_officer_current_station, get_primary_assignment, log_action, normalize_role_code
from .permissions import CanManageUsers, CanViewUsers, IsSuperAdmin
from .scoping import accounts_in_scope, people_scope


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login endpoint that returns JWT tokens with role and station info.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        from .sessions import record_login

        attempted = (request.data.get('username') or '').strip().upper()
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            known = User.objects.filter(username=attempted).first()
            reason = 'inactive' if known is not None and not known.is_active else 'bad_credentials'
            record_login(request, attempted, user=known, success=False, reason=reason)
            raise

        user = serializer.user
        record_login(request, attempted, user=user, success=True)
        request.user = user  # the request is anonymous until now; attribute the audit entry
        try:
            log_action(request=request, action=f"User logged in: {user.username}", module="AUTH",
                       remarks="Successful login")
        except Exception:
            pass
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint.
    Blacklists the refresh token sent in the body so it cannot mint new
    access tokens. Send {"refresh": "<token>"}; {"all_devices": true}
    revokes every session of this user.
    """
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import RefreshToken
    from django.utils import timezone as tz
    from .models import UserSession
    from .utils import revoke_user_tokens

    sid = request.auth.get('sid') if request.auth is not None else None
    if sid:
        UserSession.objects.filter(pk=sid, user=request.user, revoked_at__isnull=True).update(
            revoked_at=tz.now(), revoked_by=request.user, revoke_reason='Signed out')

    raw = request.data.get('refresh') if hasattr(request, 'data') else None
    if raw:
        try:
            token = RefreshToken(raw)
            if str(token.get('user_id')) == str(request.user.pk):
                token.blacklist()
        except TokenError:
            pass
    if request.data.get('all_devices'):
        from .sessions import revoke_sessions
        revoke_sessions(request.user, by=request.user, reason='Signed out on all devices')

    try:
        log_action(
            request=request,
            action=f"User logged out: {request.user.username}",
            module="AUTH",
            remarks="User logout"
        )
    except Exception:
        pass
    
    # Logout Django session (if using session auth)
    logout(request)
    
    return Response({
        "message": "Successfully logged out"
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """Current user's profile, plus whether a password change is pending."""
    from .models import UserSecurity
    response = _current_user_payload(request)
    if isinstance(response.data, dict) and response.status_code == 200:
        response.data["must_change_password"] = UserSecurity.objects.filter(
            user=request.user, must_change_password=True).exists()
        response.data["is_superuser"] = request.user.is_superuser
    return response


def _current_user_payload(request):
    """
    Get current authenticated user's profile information.
    """
    try:
        profile = request.user.userprofile
        serializer = UserProfileSerializer(profile)
        data = dict(serializer.data)
        # Legacy UserProfile corresponds to a Station-level account
        data["org_unit_unit_type"] = "STATION"
        
        from .models import OrgUnit, Department, OrgUnitDepartment
        try:
            ou = OrgUnit.objects.filter(name=profile.station.name).first() if profile.station else None
            role_code_mapping = {
                'R.O': 'RECEPTION',
                'H.O': 'HEALTH',
                'S.O': 'SECURITY'
            }
            mapped_role = role_code_mapping.get(profile.role.code, profile.role.code)
            dept = Department.objects.filter(code=mapped_role).first()
            
            if ou and dept:
                oud = OrgUnitDepartment.objects.filter(org_unit=ou, department=dept).first()
                if oud:
                    data["mailbox_address"] = oud.mailbox_address
        except Exception:
            pass
            
        return Response(data, status=status.HTTP_200_OK)
    except AttributeError:
        from .utils import get_primary_assignment
        assignment = get_primary_assignment(request.user)
        if not assignment:
            if getattr(request.user, 'is_superuser', False):
                from .models import OrgUnit, Department
                org_unit = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
                department = Department.objects.filter(code='ADMINISTRATION').first()
                return Response({
                    "user_id": request.user.id,
                    "username": request.user.username,
                    "role": "SUPER_ADMIN",
                    "role_name": "System Administrator",
                    "org_unit_id": org_unit.id if org_unit else None,
                    "org_unit_code": org_unit.code if org_unit else None,
                    "org_unit_unit_type": org_unit.unit_type if org_unit else None,
                    "department_id": department.id if department else None,
                    "department_code": department.code if department else None,
                    "department_name": department.name if department else None,
                    "mailbox_address": "administration@nat-hq.pms.local",
                    "is_active": True,
                }, status=status.HTTP_200_OK)

            return Response({
                "error": "User profile not found"
            }, status=status.HTTP_404_NOT_FOUND)

        from .models import OrgUnitDepartment
        mailbox_address = None
        if assignment.org_unit and assignment.department:
            try:
                oud = OrgUnitDepartment.objects.get(org_unit=assignment.org_unit, department=assignment.department)
                mailbox_address = oud.mailbox_address
            except OrgUnitDepartment.DoesNotExist:
                pass

        return Response({
            "user_id": request.user.id,
            "username": request.user.username,
            "role": normalize_role_code(assignment.role.code),
            "role_name": assignment.role.name,
            "org_unit_id": assignment.org_unit.id if assignment.org_unit else None,
            "org_unit_code": assignment.org_unit.code if assignment.org_unit else None,
            "org_unit_unit_type": assignment.org_unit.unit_type if assignment.org_unit else None,
            "department_id": assignment.department.id if assignment.department else None,
            "department_code": assignment.department.code if assignment.department else None,
            "department_name": assignment.department.name if assignment.department else None,
            "mailbox_address": mailbox_address,
            "is_active": assignment.is_active,
        }, status=status.HTTP_200_OK)


class UserManagementView(APIView):
    """
    Admin-only user management endpoint.
    GET lists accounts at the requester's station (or below; see Auth/scoping.py).
    POST creates a Django user and linked UserProfile from an existing officer.

    Listing needs `users.view` (Administration officers hold it); creating
    needs `users.manage`, which only system administrators hold.
    """

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated(), CanViewUsers()]
        return [IsAuthenticated(), CanManageUsers()]

    def get(self, request):
        # Everyone with an account at the requester's station (or below),
        # however the account was created: console or legacy profile.
        return Response(accounts_in_scope(people_scope(request.user)), status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

        log_action(
            request=request,
            action=f"Created system account for officer: {profile.officer.service_number}",
            module="RBAC",
            object_id=str(profile.user.id),
            object_type="UserProfile",
            remarks=f"Assigned role {normalize_role_code(profile.role.code)} at station {profile.station.code}",
        )

        response_serializer = UserProfileSerializer(profile)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    Admin-only endpoint to manage specific users (e.g., toggle active status).
    """

    permission_classes = [IsAuthenticated, CanManageUsers]

    def patch(self, request, pk):
        try:
            profile = UserProfile.objects.get(id=pk)

            from .models import UserAssignment
            from .rbac import can_manage_user
            if UserAssignment.objects.filter(user=profile.user, is_active=True).exists():
                reason = can_manage_user(request.user, profile.user)
                if reason:
                    return Response({"error": reason}, status=status.HTTP_403_FORBIDDEN)
            
            # Admins can only manage users in their own station unless SuperAdmin
            requester_assignment = get_primary_assignment(request.user)
            if requester_assignment and normalize_role_code(requester_assignment.role.code) != "SUPER_ADMIN":
                try:
                    station = request.user.userprofile.station
                    if profile.station != station:
                        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
                except AttributeError:
                    return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

            if 'is_active' in request.data:
                is_active = request.data['is_active']
                
                # Prevent deactivating oneself
                if profile.user == request.user and not is_active:
                    return Response({"error": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)
                
                profile.is_active = is_active
                profile.user.is_active = is_active
                profile.user.save()
                profile.save()
                if not is_active:
                    from .utils import revoke_user_tokens
                    revoke_user_tokens(profile.user)

                action_str = "Activated" if is_active else "Deactivated"
                log_action(
                    request=request,
                    action=f"{action_str} system account for officer: {profile.officer.service_number if profile.officer else profile.user.username}",
                    module="RBAC",
                    object_id=str(profile.id),
                    object_type="UserProfile",
                    remarks=f"Status changed to {is_active}",
                )

            serializer = UserProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)



class UserCreationOptionsView(APIView):
    """
    Admin-only endpoint to populate user creation forms.
    Returns eligible officers and assignable roles.
    """

    permission_classes = [IsAuthenticated, CanManageUsers]

    def get(self, request):
        requester_assignment = get_primary_assignment(request.user)
        requester_role_code = None
        requester_station_id = None

        if requester_assignment and requester_assignment.is_active:
            requester_role_code = normalize_role_code(requester_assignment.role.code)
            try:
                requester_station_id = request.user.userprofile.station_id
            except AttributeError:
                requester_station_id = None
        else:
            try:
                requester_profile = request.user.userprofile
                requester_role_code = normalize_role_code(requester_profile.role.code)
                requester_station_id = requester_profile.station_id
            except AttributeError:
                requester_role_code = None
                requester_station_id = None

        officers = Officer.objects.filter(current_status="ACTIVE").prefetch_related("station_history")
        officers = officers.exclude(system_account__isnull=False)
        officers = officers.exclude(
            service_number__in=User.objects.values_list("username", flat=True)
        )

        eligible_officers = []
        for officer in officers:
            station = get_officer_current_station(officer)
            if not station:
                continue
            if requester_role_code != "SUPER_ADMIN" and station.id != requester_station_id:
                continue
            eligible_officers.append(officer)

        # Station accounts get operational roles. Admin roles (system admins)
        # are granted only by HQ, through role assignments.
        from .rbac import is_national_admin
        roles = Role.objects.filter(is_active=True).order_by("name")
        if not (requester_role_code == "SUPER_ADMIN" or is_national_admin(request.user)):
            roles = roles.filter(is_admin_role=False)

        return Response(
            {
                "officers": AvailableOfficerSerializer(eligible_officers, many=True).data,
                "roles": RoleSerializer(roles, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class PhaseOneSetupView(APIView):
    """Phase 1 setup wizard API."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        config = SystemConfig.objects.first()
        data = {
            "setup_status": config.setup_status if config else "UNINITIALIZED",
            "national_hq": config.national_hq.code if config and config.national_hq else None,
            "setup_sealed_by": config.setup_sealed_by.user.username if config and config.setup_sealed_by else None,
            "setup_sealed_at": config.setup_sealed_at if config else None,
        }
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        action = request.data.get("action", "full_setup")
        permitted_actions = {
            "create_hierarchy": "--create-hierarchy",
            "backfill_data": "--backfill-data",
            "create_assignments": "--create-assignments",
            "full_setup": "--full-setup",
        }

        if action not in permitted_actions:
            return Response(
                {"error": "Unsupported action. Use create_hierarchy, backfill_data, create_assignments, or full_setup."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        out = StringIO()
        call_command('setup_org_hierarchy', permitted_actions[action], stdout=out)
        return Response(
            {
                "action": action,
                "output": out.getvalue(),
            },
            status=status.HTTP_200_OK,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def heartbeat_view(request):
    """Keeps the session marked online while a page is open. Authentication does the work."""
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """Change your own password. Ends every other session and returns fresh tokens."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.utils import timezone as tz
    from .models import UserSecurity
    from .sessions import revoke_sessions, start_session

    current = request.data.get('current_password') or ''
    new = request.data.get('new_password') or ''
    user = request.user
    if not user.check_password(current):
        return Response({'current_password': ['Your current password is incorrect.']},
                        status=status.HTTP_400_BAD_REQUEST)
    if current == new:
        return Response({'new_password': ['Choose a password different from the current one.']},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, user=user)
    except DjangoValidationError as exc:
        return Response({'new_password': exc.messages}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new)
    user.save(update_fields=['password'])
    security = UserSecurity.for_user(user)
    security.must_change_password = False
    security.password_changed_at = tz.now()
    security.save()
    revoke_sessions(user, by=user, reason='Password changed')

    assignment = get_primary_assignment(user)
    session = start_session(user, request, assignment.org_unit if assignment else None)
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    refresh['sid'] = str(session.id)
    log_action(request=request, action=f"Password changed: {user.username}", module="AUTH",
               remarks="User changed own password")
    return Response({'refresh': str(refresh), 'access': str(refresh.access_token)}, status=status.HTTP_200_OK)
