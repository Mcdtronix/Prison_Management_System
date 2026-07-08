from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
import csv
from django.db import models

from .models import AuditLog, OrgUnit
from .serializers_audit import AuditLogSerializer
from .rbac import user_has_capability
from .permissions import IsAdminOfficer

class IsScopedAdmin(permissions.BasePermission):
    """Permission that allows NHQ/PHQ/Station admins to view logs within their scope.

    - Superusers allowed.
    - Otherwise, user must have `admin.view_created_logs` capability scoped to the requested org (if supplied),
      or have capability at their own assignment scope.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        # If caller requests their own logs, allow
        if request.query_params.get('created_by') == 'me':
            return True

        # If a scope is provided (org_unit), check capability for that org
        org_id = request.query_params.get('org_unit')
        if org_id:
            try:
                org = OrgUnit.objects.get(pk=int(org_id))
            except Exception:
                org = None
            return user_has_capability(request.user, 'admin.view_created_logs', target_org=org)

        # Fallback: check if user has global admin capability
        return user_has_capability(request.user, 'admin.view_created_logs', target_org=None)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOfficer]

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by actor if requested
        actor = self.request.query_params.get('created_by')
        org_id = self.request.query_params.get('org_unit')
        module = self.request.query_params.get('module')
        if actor == 'me':
            qs = qs.filter(user=self.request.user)
        if org_id:
            # Filter logs that reference the supplied org_unit id either as object or station
            qs = qs.filter(models.Q(object_type='OrgUnit', object_id=str(org_id)) | models.Q(station__id=org_id))
        if module:
            qs = qs.filter(module=module)
        return qs

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        """Export the current filtered queryset as CSV. Permission enforced as usual."""
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        writer = csv.writer(response)
        writer.writerow(['timestamp', 'user', 'role', 'station', 'action', 'module', 'object_type', 'object_id', 'ip', 'path', 'remarks'])
        for a in qs.iterator():
            writer.writerow([
                a.timestamp.isoformat(),
                a.user.username if a.user else '',
                a.role,
                a.station.code if a.station else '',
                a.action,
                a.module,
                a.object_type or '',
                a.object_id or '',
                a.ip_address or '',
                a.request_path or '',
                (a.remarks or '').replace('\n',' '),
            ])
        return response
