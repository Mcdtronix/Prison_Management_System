from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .serializers_admin import CreatePHQSerializer, CreateAdminSerializer, CreateStationSerializer
from .models import OrgUnit, UserAssignment, Department
from .utils import create_audit_log
from .rbac import user_has_capability
from django.contrib.auth import get_user_model

User = get_user_model()


class AdminWorkflowViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _ensure_capable(self, request, capability, target_org=None):
        if request.user.is_superuser:
            return True
        if not user_has_capability(request.user, capability, target_org=target_org):
            return False
        return True

    @action(detail=False, methods=['post'], url_path='phq')
    def create_phq(self, request):
        # Only NHQ admins may create PHQs
        if not self._ensure_capable(request, 'admin.create_phq'):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreatePHQSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phq = serializer.save()
        create_audit_log(request.user, action='CREATE_PHQ', module='RBAC', object_type='OrgUnit', object_id=phq.pk, remarks=f'PHQ {phq.code} created', role=getattr(request.user, 'username', None), station=None)
        return Response({'id': phq.pk, 'code': phq.code}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='create_admin')
    def create_admin(self, request, pk=None):
        # Create admin user for a given org unit
        try:
            org = OrgUnit.objects.get(pk=pk)
        except OrgUnit.DoesNotExist:
            return Response({'detail': 'Org unit not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check capability for creating admin users in this org
        if not self._ensure_capable(request, 'admin.assign_phq_admin', target_org=org):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CreateAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.create(serializer.validated_data, org_unit=org)

        # create assignment: use Department ADMIN if available
        dept, _ = Department.objects.get_or_create(code='ADMIN', defaults={'name': 'Administration'})
        ua = UserAssignment.objects.create(user=user, role=serializer.validated_data['role'], org_unit=org, department=dept, is_primary=True)

        create_audit_log(request.user, action='CREATE_ORG_ADMIN', module='RBAC', object_type='User', object_id=user.pk, remarks=f'Created admin {user.username} for {org.code}', role=getattr(request.user, 'username', None), station=None)
        return Response({'id': user.pk, 'username': user.username}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='station')
    def create_station(self, request):
        # PHQ admins may create stations
        parent_id = request.data.get('parent')
        parent = None
        if parent_id:
            try:
                parent = OrgUnit.objects.get(pk=parent_id)
            except OrgUnit.DoesNotExist:
                parent = None

        if not self._ensure_capable(request, 'admin.create_station', target_org=parent):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CreateStationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        station = serializer.save()
        create_audit_log(request.user, action='CREATE_STATION', module='RBAC', object_type='OrgUnit', object_id=station.pk, remarks=f'Station {station.code} created under {station.parent.code if station.parent else ""}', role=getattr(request.user, 'username', None), station=None)
        return Response({'id': station.pk, 'code': station.code}, status=status.HTTP_201_CREATED)
