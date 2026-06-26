from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from .models import Role, Department, UserAssignment, DataExposurePolicy, DataExposureRecord, OrgUnitDepartment
from .serializers_admin import (
    RoleSerializer, DepartmentSerializer, OrgUnitDepartmentSerializer,
    UserAssignmentSerializer, DataExposurePolicySerializer, DataExposureRecordSerializer
)

class AdminBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_admin_org_unit(self):
        # Assumes the admin user is bound to an org_unit via their primary UserAssignment
        user = self.request.user
        if user.is_superuser:
            return None # superuser can see all
        primary_assignment = user.org_assignments.filter(is_primary=True, is_active=True).first()
        if primary_assignment:
            return primary_assignment.org_unit
        return None

class RoleViewSet(AdminBaseViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    
class DepartmentViewSet(AdminBaseViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

class OrgUnitDepartmentViewSet(AdminBaseViewSet):
    serializer_class = OrgUnitDepartmentSerializer

    def get_queryset(self):
        org_unit = self.get_admin_org_unit()
        if org_unit is None and self.request.user.is_superuser:
            return OrgUnitDepartment.objects.all()
        elif org_unit:
            return OrgUnitDepartment.objects.filter(org_unit=org_unit)
        return OrgUnitDepartment.objects.none()

class UserAssignmentViewSet(AdminBaseViewSet):
    serializer_class = UserAssignmentSerializer

    def get_queryset(self):
        org_unit = self.get_admin_org_unit()
        if org_unit is None and self.request.user.is_superuser:
            return UserAssignment.objects.all()
        elif org_unit:
            return UserAssignment.objects.filter(org_unit=org_unit)
        return UserAssignment.objects.none()

    def perform_create(self, serializer):
        org_unit = self.get_admin_org_unit()
        if org_unit and not serializer.validated_data.get('org_unit'):
            serializer.save(org_unit=org_unit)
        else:
            serializer.save()

class DataExposurePolicyViewSet(AdminBaseViewSet):
    serializer_class = DataExposurePolicySerializer

    def get_queryset(self):
        org_unit = self.get_admin_org_unit()
        if org_unit is None and self.request.user.is_superuser:
            return DataExposurePolicy.objects.all()
        elif org_unit:
            return DataExposurePolicy.objects.filter(Q(source_org_unit=org_unit) | Q(target_org_unit=org_unit))
        return DataExposurePolicy.objects.none()

class DataExposureRecordViewSet(AdminBaseViewSet):
    serializer_class = DataExposureRecordSerializer

    def get_queryset(self):
        org_unit = self.get_admin_org_unit()
        if org_unit is None and self.request.user.is_superuser:
            return DataExposureRecord.objects.all()
        elif org_unit:
            return DataExposureRecord.objects.filter(Q(target_org_unit=org_unit) | Q(policy__source_org_unit=org_unit))
        return DataExposureRecord.objects.none()
