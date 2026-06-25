"""
Authentication Views
====================
JWT-based authentication endpoints with role-based access control.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
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
from .permissions import IsAdminOfficer, IsSuperAdmin


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login endpoint that returns JWT tokens with role and station info.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Log successful login
            try:
                user = User.objects.get(username=request.data.get('username'))
                log_action(
                    request=request,
                    action=f"User logged in: {user.username}",
                    module="AUTH",
                    remarks="Successful login"
                )
            except User.DoesNotExist:
                pass
        
        return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint.
    In JWT, logout is primarily handled client-side by discarding tokens.
    Optionally, you can implement token blacklisting here.
    """
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
    """
    Get current authenticated user's profile information.
    """
    try:
        profile = request.user.userprofile
        serializer = UserProfileSerializer(profile)
        data = dict(serializer.data)
        # Legacy UserProfile corresponds to a Station-level account
        data["org_unit_unit_type"] = "STATION"
        return Response(data, status=status.HTTP_200_OK)
    except AttributeError:
        from .utils import get_primary_assignment
        assignment = get_primary_assignment(request.user)
        if not assignment:
            return Response({
                "error": "User profile not found"
            }, status=status.HTTP_404_NOT_FOUND)

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
            "is_active": assignment.is_active,
        }, status=status.HTTP_200_OK)


class UserManagementView(APIView):
    """
    Admin-only user management endpoint.
    GET lists users at the current admin station.
    POST creates a Django user and linked UserProfile from an existing officer.
    """

    permission_classes = [IsAuthenticated, IsAdminOfficer]

    def get_queryset(self):
        queryset = UserProfile.objects.select_related("user", "role", "station", "officer")
        requester_assignment = get_primary_assignment(self.request.user)

        if requester_assignment and normalize_role_code(requester_assignment.role.code) == "SUPER_ADMIN":
            return queryset

        if requester_assignment and requester_assignment.org_unit:
            station = None
            try:
                station = self.request.user.userprofile.station
            except AttributeError:
                station = None
            if station:
                return queryset.filter(station=station)

        try:
            requester_profile = self.request.user.userprofile
        except AttributeError:
            return queryset.none()

        if normalize_role_code(requester_profile.role.code) == "SUPER_ADMIN":
            return queryset

        return queryset.filter(station=requester_profile.station)

    def get(self, request):
        profiles = self.get_queryset().filter(is_active=True)
        serializer = UserProfileSerializer(profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

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

    permission_classes = [IsAuthenticated, IsAdminOfficer]

    def patch(self, request, pk):
        try:
            profile = UserProfile.objects.get(id=pk)
            
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

    permission_classes = [IsAuthenticated, IsAdminOfficer]

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

        roles = Role.objects.filter(is_active=True).order_by("name")
        if requester_role_code != "SUPER_ADMIN":
            roles = [role for role in roles if normalize_role_code(role.code) != "SUPER_ADMIN"]

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
