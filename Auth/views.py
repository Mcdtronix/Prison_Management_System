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

from HumanResources.models import Officer

from .models import Role, UserProfile
from .serializers import (
    AvailableOfficerSerializer,
    CustomTokenObtainPairSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
)
from .utils import get_officer_current_station, log_action, normalize_role_code
from .permissions import IsAdminOfficer


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
        return Response(serializer.data, status=status.HTTP_200_OK)
    except AttributeError:
        return Response({
            "error": "User profile not found"
        }, status=status.HTTP_404_NOT_FOUND)


class UserManagementView(APIView):
    """
    Admin-only user management endpoint.
    GET lists users at the current admin station.
    POST creates a Django user and linked UserProfile from an existing officer.
    """

    permission_classes = [IsAuthenticated, IsAdminOfficer]

    def get_queryset(self):
        queryset = UserProfile.objects.select_related("user", "role", "station", "officer")
        requester_profile = self.request.user.userprofile

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


class UserCreationOptionsView(APIView):
    """
    Admin-only endpoint to populate user creation forms.
    Returns eligible officers and assignable roles.
    """

    permission_classes = [IsAuthenticated, IsAdminOfficer]

    def get(self, request):
        requester_profile = request.user.userprofile
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
            if normalize_role_code(requester_profile.role.code) != "SUPER_ADMIN" and station.id != requester_profile.station_id:
                continue
            eligible_officers.append(officer)

        roles = Role.objects.filter(is_active=True).order_by("name")
        if normalize_role_code(requester_profile.role.code) != "SUPER_ADMIN":
            roles = [role for role in roles if normalize_role_code(role.code) != "SUPER_ADMIN"]

        return Response(
            {
                "officers": AvailableOfficerSerializer(eligible_officers, many=True).data,
                "roles": RoleSerializer(roles, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
