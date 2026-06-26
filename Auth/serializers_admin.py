from rest_framework import serializers
from .models import OrgUnit, Department, Role
from django.contrib.auth import get_user_model
from HumanResources.models import Officer

User = get_user_model()


class CreatePHQSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    code = serializers.CharField(max_length=50)
    code_short = serializers.CharField(max_length=20)

    def validate(self, attrs):
        if OrgUnit.objects.filter(code=attrs['code']).exists():
            raise serializers.ValidationError({'code': 'Org unit code already exists'})
        return attrs

    def create(self, validated_data):
        return OrgUnit.objects.create(
            name=validated_data['name'],
            code=validated_data['code'],
            code_short=validated_data['code_short'],
            unit_type='PROVINCIAL_HQ'
        )


class CreateAdminSerializer(serializers.Serializer):
    officer = serializers.PrimaryKeyRelatedField(queryset=Officer.objects.filter(current_status='ACTIVE'))
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.filter(is_active=True))
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        officer = attrs['officer']
        if User.objects.filter(username=officer.service_number).exists():
            raise serializers.ValidationError({'officer': 'Officer already has a user account'})
        return attrs

    def create(self, validated_data, org_unit=None):
        officer = validated_data['officer']
        role = validated_data['role']
        password = validated_data['password']
        email = validated_data.get('email', '')

        user = User.objects.create_user(username=officer.service_number, email=email, password=password, first_name=officer.first_name, last_name=officer.surname)
        # Attach a UserAssignment later in the view where org_unit is known
        return user


class CreateStationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    code = serializers.CharField(max_length=50)
    code_short = serializers.CharField(max_length=20)
    parent = serializers.PrimaryKeyRelatedField(queryset=OrgUnit.objects.filter(unit_type='PROVINCIAL_HQ'))

    def validate(self, attrs):
        if OrgUnit.objects.filter(code=attrs['code']).exists():
            raise serializers.ValidationError({'code': 'Org unit code already exists'})
        return attrs

    def create(self, validated_data):
        return OrgUnit.objects.create(
            name=validated_data['name'],
            code=validated_data['code'],
            code_short=validated_data['code_short'],
            unit_type='STATION',
            parent=validated_data['parent']
        )

from .models import Role, Department, UserAssignment, DataExposurePolicy, DataExposureRecord, OrgUnitDepartment

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

class OrgUnitDepartmentSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    class Meta:
        model = OrgUnitDepartment
        fields = '__all__'

class UserAssignmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    role_name = serializers.CharField(source='role.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = UserAssignment
        fields = '__all__'

    def get_full_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip()
        return ""

class DataExposurePolicySerializer(serializers.ModelSerializer):
    source_org_name = serializers.CharField(source='source_org_unit.name', read_only=True)
    target_org_name = serializers.CharField(source='target_org_unit.name', read_only=True)
    class Meta:
        model = DataExposurePolicy
        fields = '__all__'

class DataExposureRecordSerializer(serializers.ModelSerializer):
    policy_code = serializers.CharField(source='policy.code', read_only=True)
    target_org_name = serializers.CharField(source='target_org_unit.name', read_only=True)
    class Meta:
        model = DataExposureRecord
        fields = '__all__'
