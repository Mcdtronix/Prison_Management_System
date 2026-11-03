from rest_framework import serializers
from .models import OrgUnit, Department, Role
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
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
        nhq = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
        if nhq is None:
            raise serializers.ValidationError('Set up National HQ before creating provinces.')
        return OrgUnit.objects.create(
            name=validated_data['name'],
            code=validated_data['code'],
            code_short=validated_data['code_short'],
            unit_type='PROVINCIAL_HQ',
            parent=nhq,
        )


class CreateAdminSerializer(serializers.Serializer):
    officer = serializers.PrimaryKeyRelatedField(queryset=Officer.objects.filter(current_status='ACTIVE'))
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.filter(is_active=True))
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        officer = attrs['officer']
        if User.objects.filter(username=officer.service_number).exists():
            raise serializers.ValidationError({'officer': 'Officer already has a user account'})
        probe = User(username=officer.service_number, first_name=officer.first_name, last_name=officer.surname)
        try:
            validate_password(attrs['password'], user=probe)
        except Exception as exc:
            raise serializers.ValidationError({'password': list(getattr(exc, 'messages', [str(exc)]))})
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

from django.core.exceptions import ValidationError as DjangoValidationError

from .models import Role, Department, UserAssignment, DataExposurePolicy, DataExposureRecord, OrgUnitDepartment


class ModelRulesMixin:
    """Turn model-level rule violations (built-in protection, role/department
    mismatch) into 400 responses instead of server errors."""

    def _guard(self, fn, *args):
        try:
            return fn(*args)
        except DjangoValidationError as exc:
            detail = exc.message_dict if hasattr(exc, 'error_dict') else {'detail': exc.messages}
            raise serializers.ValidationError(detail)

    def create(self, validated_data):
        return self._guard(super().create, validated_data)

    def update(self, instance, validated_data):
        return self._guard(super().update, instance, validated_data)


class RoleSerializer(ModelRulesMixin, serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.code', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = '__all__'
        read_only_fields = ('is_system', 'is_admin_role', 'created_at', 'updated_at')

    def get_capabilities(self, obj):
        return sorted(c.capability for c in obj.capabilities.all())


class DepartmentSerializer(ModelRulesMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'
        read_only_fields = ('is_system', 'created_at', 'updated_at')


class OrgUnitDepartmentSerializer(ModelRulesMixin, serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    class Meta:
        model = OrgUnitDepartment
        fields = '__all__'

class UserAssignmentSerializer(ModelRulesMixin, serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    role_name = serializers.CharField(source='role.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = UserAssignment
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at', 'revoked_by', 'revoked_at')

    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', None))
        dept = attrs.get('department', getattr(self.instance, 'department', None))
        if role is not None and role.department_id and (dept is None or dept.pk != role.department_id):
            raise serializers.ValidationError(
                {'department': f'{role.name} belongs to the {role.department.name} department.'})
        return attrs

    def run_validators(self, value):
        # The "one active primary per user" constraint needs these fields; on a
        # PATCH fill them from the existing row so the check can run.
        if self.partial and self.instance is not None:
            for field in ('user', 'is_primary', 'is_active'):
                value.setdefault(field, getattr(self.instance, field))
        super().run_validators(value)

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
        read_only_fields = ('created_by', 'approved_by', 'approved_at', 'revoked_by', 'revoked_at',
                            'created_at', 'updated_at')

class DataExposureRecordSerializer(serializers.ModelSerializer):
    policy_code = serializers.CharField(source='policy.code', read_only=True)
    target_org_name = serializers.CharField(source='target_org_unit.name', read_only=True)
    class Meta:
        model = DataExposureRecord
        fields = '__all__'
        read_only_fields = ('exposed_by', 'exposed_at', 'revoked_by', 'revoked_at')
