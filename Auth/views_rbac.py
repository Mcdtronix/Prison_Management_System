from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from .admin_guard import (
    IsSuperAdminOrReadOnly,
    can_grant,
    has_scoped_capability,
    scoped_org_ids,
)
from .models import DataExposurePolicy, DataExposureRecord, Department, OrgUnitDepartment, Role, UserAssignment
from .serializers_admin import (
    DataExposurePolicySerializer,
    DataExposureRecordSerializer,
    DepartmentSerializer,
    OrgUnitDepartmentSerializer,
    RoleSerializer,
    UserAssignmentSerializer,
)
from .utils import create_audit_log, get_primary_assignment


def _require(user, capability, org_unit):
    if not has_scoped_capability(user, capability, org_unit):
        raise PermissionDenied('You do not have permission to manage this org unit.')


def _filter_by_scope(qs, ids, *fields):
    """Limit `qs` to rows whose org fields fall inside `ids` (None means no limit)."""
    if ids is None:
        return qs
    cond = Q()
    for f in fields:
        cond |= Q(**{f'{f}__in': ids})
    return qs.filter(cond)


def _actor(request):
    """The acting admin's primary assignment; the *_by audit columns point at it."""
    return get_primary_assignment(request.user)


def _log(request, action, obj, remarks=''):
    try:
        create_audit_log(
            request.user, action=action, module='RBAC',
            object_type=type(obj).__name__, object_id=obj.pk, remarks=remarks,
            role=getattr(request.user, 'username', None), station=None,
        )
    except Exception:
        pass


class AdminBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]


class RoleViewSet(AdminBaseViewSet):
    """Roles are system-wide: everyone may read, only super admins may change."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsSuperAdminOrReadOnly]


class DepartmentViewSet(AdminBaseViewSet):
    """Departments are system-wide: everyone may read, only super admins may change."""
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsSuperAdminOrReadOnly]


class OrgUnitDepartmentViewSet(AdminBaseViewSet):
    serializer_class = OrgUnitDepartmentSerializer
    capability = 'admin.manage_station_departments'

    def get_queryset(self):
        ids = scoped_org_ids(self.request.user, self.capability)
        return _filter_by_scope(OrgUnitDepartment.objects.all(), ids, 'org_unit_id')

    def perform_create(self, serializer):
        _require(self.request.user, self.capability, serializer.validated_data.get('org_unit'))
        serializer.save()

    def perform_update(self, serializer):
        _require(self.request.user, self.capability, serializer.instance.org_unit)
        _require(self.request.user, self.capability,
                 serializer.validated_data.get('org_unit', serializer.instance.org_unit))
        serializer.save()

    def perform_destroy(self, instance):
        _require(self.request.user, self.capability, instance.org_unit)
        instance.delete()


class UserAssignmentViewSet(AdminBaseViewSet):
    serializer_class = UserAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        ids = scoped_org_ids(user, 'assignments.manage')
        qs = UserAssignment.objects.select_related('user', 'role', 'org_unit', 'department')
        if ids is None:
            return qs
        return qs.filter(Q(org_unit_id__in=ids) | Q(user=user))

    def _check(self, role, org_unit, target_user):
        reason = can_grant(self.request.user, role, org_unit, target_user)
        if reason:
            raise PermissionDenied(reason)

    def perform_create(self, serializer):
        data = serializer.validated_data
        self._check(data.get('role'), data.get('org_unit'), data.get('user'))
        obj = serializer.save(created_by=_actor(self.request))
        _log(self.request, 'ASSIGN_ROLE', obj,
             f'{obj.user.username} -> {obj.role.code} at {obj.org_unit.code}')

    def perform_update(self, serializer):
        inst = serializer.instance
        data = serializer.validated_data
        # The admin must control both the assignment as it is and as it will be.
        self._check(inst.role, inst.org_unit, inst.user)
        self._check(data.get('role', inst.role), data.get('org_unit', inst.org_unit),
                    data.get('user', inst.user))
        obj = serializer.save()
        _log(self.request, 'UPDATE_ROLE_ASSIGNMENT', obj,
             f'{obj.user.username} -> {obj.role.code} at {obj.org_unit.code}, active={obj.is_active}')

    def perform_destroy(self, instance):
        self._check(instance.role, instance.org_unit, instance.user)
        _log(self.request, 'DELETE_ROLE_ASSIGNMENT', instance,
             f'{instance.user.username} {instance.role.code} at {instance.org_unit.code}')
        instance.delete()


class DataExposurePolicyViewSet(AdminBaseViewSet):
    serializer_class = DataExposurePolicySerializer

    def get_queryset(self):
        ids = scoped_org_ids(self.request.user, 'policies.view')
        return _filter_by_scope(DataExposurePolicy.objects.all(), ids,
                                'source_org_unit_id', 'target_org_unit_id')

    def _status_side_effects(self, serializer, previous_status=None):
        user = self.request.user
        new_status = serializer.validated_data.get('status', previous_status)
        source = serializer.validated_data.get(
            'source_org_unit', getattr(serializer.instance, 'source_org_unit', None))
        extra = {}
        if new_status == 'APPROVED' and previous_status != 'APPROVED':
            _require(user, 'policies.approve', source)
            creator = getattr(serializer.instance, 'created_by', None)
            if creator is not None and creator.user_id == user.pk and not user.is_superuser:
                raise PermissionDenied('A policy must be approved by someone other than its author.')
            if serializer.instance is None:
                raise PermissionDenied('Create the policy first; a second admin approves it.')
            extra.update(approved_by=_actor(self.request), approved_at=timezone.now())
        if new_status == 'REVOKED' and previous_status != 'REVOKED':
            _require(user, 'policies.revoke', source)
            extra.update(revoked_by=_actor(self.request), revoked_at=timezone.now())
        return extra

    def perform_create(self, serializer):
        _require(self.request.user, 'policies.create', serializer.validated_data.get('source_org_unit'))
        extra = self._status_side_effects(serializer)
        obj = serializer.save(created_by=_actor(self.request), **extra)
        _log(self.request, 'CREATE_EXPOSURE_POLICY', obj, f'{obj.code} status={obj.status}')

    def perform_update(self, serializer):
        inst = serializer.instance
        _require(self.request.user, 'policies.create', inst.source_org_unit)
        _require(self.request.user, 'policies.create',
                 serializer.validated_data.get('source_org_unit', inst.source_org_unit))
        extra = self._status_side_effects(serializer, previous_status=inst.status)
        obj = serializer.save(**extra)
        _log(self.request, 'UPDATE_EXPOSURE_POLICY', obj, f'{obj.code} status={obj.status}')

    def perform_destroy(self, instance):
        _require(self.request.user, 'policies.revoke', instance.source_org_unit)
        _log(self.request, 'DELETE_EXPOSURE_POLICY', instance, instance.code)
        instance.delete()


class DataExposureRecordViewSet(AdminBaseViewSet):
    serializer_class = DataExposureRecordSerializer
    capability = 'cases.manage_exposure'

    def get_queryset(self):
        ids = scoped_org_ids(self.request.user, 'policies.view')
        return _filter_by_scope(DataExposureRecord.objects.select_related('policy'), ids,
                                'target_org_unit_id', 'policy__source_org_unit_id')

    def perform_create(self, serializer):
        policy = serializer.validated_data.get('policy')
        _require(self.request.user, self.capability, getattr(policy, 'source_org_unit', None))
        obj = serializer.save(exposed_by=_actor(self.request))
        _log(self.request, 'CREATE_EXPOSURE_RECORD', obj, f'policy={policy.code}')

    def perform_update(self, serializer):
        inst = serializer.instance
        _require(self.request.user, self.capability, inst.policy.source_org_unit)
        policy = serializer.validated_data.get('policy', inst.policy)
        _require(self.request.user, self.capability, policy.source_org_unit)
        serializer.save()

    def perform_destroy(self, instance):
        _require(self.request.user, self.capability, instance.policy.source_org_unit)
        _log(self.request, 'DELETE_EXPOSURE_RECORD', instance, f'policy={instance.policy.code}')
        instance.delete()
