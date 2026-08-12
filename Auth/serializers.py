"""
JWT Authentication Serializers
===============================
Custom token serializer that includes role and station information in JWT payload.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.db import transaction

from HumanResources.models import Officer

from .models import UserProfile, Role, Station
from .utils import get_officer_current_station, normalize_role_code

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer that includes role and station in token payload.
    This allows the frontend to know user permissions without additional API calls.
    """
    def validate(self, attrs):
        submitted_username = attrs.get("username", "")
        normalized_username = submitted_username.strip().upper()

        if normalized_username:
            attrs["username"] = normalized_username

            # Support legacy accounts whose Django username does not match the
            # officer service number used by the frontend login form.
            if not User.objects.filter(username=normalized_username).exists():
                profile = (
                    UserProfile.objects.select_related("user", "officer")
                    .filter(officer__service_number=normalized_username)
                    .first()
                )
                if profile:
                    attrs["username"] = profile.user.username

        data = super().validate(attrs)
        
        # Prefer primary UserAssignment for auth context, fall back to legacy UserProfile
        from .utils import get_primary_assignment
        assignment = get_primary_assignment(self.user)
        profile = None
        if assignment:
            role = assignment.role
            org_unit = assignment.org_unit
            department = assignment.department
            role_code = normalize_role_code(role.code)
            role_name = role.name
            data["role"] = role_code
            data["role_name"] = role_name
            data["org_unit_id"] = org_unit.id if org_unit else None
            data["org_unit_code"] = org_unit.code if org_unit else None
            data["org_unit_name"] = org_unit.name if org_unit else None
            data["org_unit_unit_type"] = org_unit.unit_type if org_unit else None
            data["department_id"] = department.id if department else None
            data["department_code"] = department.code if department else None
            data["department_name"] = department.name if department else None
            
            # Fetch mailbox address
            from .models import OrgUnitDepartment
            if org_unit and department:
                try:
                    oud = OrgUnitDepartment.objects.get(org_unit=org_unit, department=department)
                    data["mailbox_address"] = oud.mailbox_address
                except OrgUnitDepartment.DoesNotExist:
                    data["mailbox_address"] = None
        else:
            try:
                profile = self.user.userprofile
                if not profile.is_active:
                    raise serializers.ValidationError({
                        "error": "User account is inactive. Please contact administrator."
                    })

                data["role"] = normalize_role_code(profile.role.code)
                data["role_name"] = profile.role.name
                data["station_id"] = profile.station.id
                data["station_code"] = profile.station.code
                data["station_name"] = profile.station.name
                # Legacy UserProfile-based accounts map to a Station unit
                data["org_unit_unit_type"] = "STATION"
            except UserProfile.DoesNotExist:
                if self.user.is_superuser:
                    # Fallback for Django superusers created via CLI without a profile
                    data["role"] = "SUPER_ADMIN"
                    data["role_name"] = "Super Administrator"
                    data["org_unit_unit_type"] = "NATIONAL_HQ"
                else:
                    raise serializers.ValidationError({
                        "error": "User profile not found. Please contact administrator."
                    })

        data["user_id"] = self.user.id
        data["username"] = self.user.username
        
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile"""
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.SerializerMethodField()
    station_name = serializers.CharField(source='station.name', read_only=True)
    station_code = serializers.CharField(source='station.code', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    officer_service_number = serializers.CharField(source='officer.service_number', read_only=True)
    officer_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'officer', 'officer_service_number', 'officer_name',
            'role', 'role_name', 'role_code',
            'station', 'station_name', 'station_code',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_officer_name(self, obj):
        if not obj.officer:
            return None
        names = [obj.officer.first_name, obj.officer.other_names, obj.officer.surname]
        return " ".join(name for name in names if name)

    def get_role_code(self, obj):
        return normalize_role_code(obj.role.code)


class AvailableOfficerSerializer(serializers.ModelSerializer):
    current_station_id = serializers.SerializerMethodField()
    current_station_name = serializers.SerializerMethodField()
    current_station_code = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Officer
        fields = [
            "service_number",
            "full_name",
            "first_name",
            "surname",
            "other_names",
            "current_status",
            "current_station_id",
            "current_station_code",
            "current_station_name",
        ]

    def get_full_name(self, obj):
        names = [obj.first_name, obj.other_names, obj.surname]
        return " ".join(name for name in names if name)

    def _get_station(self, obj):
        return get_officer_current_station(obj)

    def get_current_station_id(self, obj):
        station = self._get_station(obj)
        return station.id if station else None

    def get_current_station_name(self, obj):
        station = self._get_station(obj)
        return station.name if station else None

    def get_current_station_code(self, obj):
        station = self._get_station(obj)
        return station.code if station else None


class UserCreateSerializer(serializers.Serializer):
    officer = serializers.PrimaryKeyRelatedField(queryset=Officer.objects.all())
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.filter(is_active=True))
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        request = self.context["request"]
        officer = attrs["officer"]
        role = attrs["role"]

        if officer.current_status != "ACTIVE":
            raise serializers.ValidationError({
                "officer": "Only officers with ACTIVE status can get system accounts."
            })

        if UserProfile.objects.filter(officer=officer).exists():
            raise serializers.ValidationError({
                "officer": "This officer already has a linked system account."
            })

        if User.objects.filter(username=officer.service_number).exists():
            raise serializers.ValidationError({
                "officer": "A system user with this officer's service number already exists."
            })

        station = get_officer_current_station(officer)
        if not station:
            raise serializers.ValidationError({
                "officer": "Officer must have station history before a system account can be created."
            })

        requester_profile = request.user.userprofile
        requester_is_super_admin = normalize_role_code(requester_profile.role.code) == "SUPER_ADMIN"

        if not requester_is_super_admin:
            if normalize_role_code(role.code) == "SUPER_ADMIN":
                raise serializers.ValidationError({
                    "role": "Only super administrators can create SUPER_ADMIN accounts."
                })
            if station_id := getattr(station, "id", None):
                if station_id != requester_profile.station_id:
                    raise serializers.ValidationError({
                        "officer": "You can only create accounts for officers in your station."
                    })

        attrs["station"] = station
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        officer = validated_data["officer"]
        role = validated_data["role"]
        station = validated_data["station"]
        password = validated_data["password"]
        email = validated_data.get("email", "")
        is_active = validated_data.get("is_active", True)

        user = User.objects.create_user(
            username=officer.service_number,
            email=email,
            password=password,
            first_name=officer.first_name,
            last_name=officer.surname,
            is_active=is_active,
        )

        profile = UserProfile.objects.create(
            user=user,
            officer=officer,
            role=role,
            station=station,
            is_active=is_active,
        )
        return profile


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model"""
    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'is_active']
        read_only_fields = ['id']


class StationSerializer(serializers.ModelSerializer):
    """Serializer for Station model"""
    class Meta:
        model = Station
        fields = ['id', 'code', 'name', 'location', 'active']
        read_only_fields = ['id']

