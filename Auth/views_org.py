"""Read-only list of the organisation: National HQ, provinces and stations.

Mounted at /api/auth/org-units/.

    GET /org-units/                          every active unit
    GET /org-units/?unit_type=PROVINCIAL_HQ  provincial command centres
    GET /org-units/?unit_type=STATION        stations
    GET /org-units/?parent=<id>              units directly under <id>
    GET /org-units/?search=chiv              name or code contains "chiv"
    GET /org-units/?include_inactive=1       also show disabled units
    GET /org-units/<id>/                     one unit
    GET /org-units/<id>/stations/            stations under one province

Like departments, the structure is readable by any signed-in user (it feeds
dropdowns everywhere). Creating units stays in /admin-actions/, which checks
the caller's capability.
"""
from django.db.models import Count, Q
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import OrgUnit

UNIT_TYPES = {code for code, _ in OrgUnit.UNIT_TYPES}


class OrgUnitSerializer(serializers.ModelSerializer):
    unit_type_display = serializers.CharField(source='get_unit_type_display', read_only=True)
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    station_count = serializers.IntegerField(read_only=True, default=None)

    class Meta:
        model = OrgUnit
        fields = ['id', 'code', 'code_short', 'name', 'unit_type', 'unit_type_display',
                  'parent', 'parent_name', 'location', 'active', 'station_count']
        read_only_fields = fields


class OrgUnitViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrgUnitSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        params = self.request.query_params
        qs = OrgUnit.objects.select_related('parent').annotate(
            station_count=Count('children', filter=Q(children__unit_type='STATION')))

        if params.get('include_inactive') not in ('1', 'true', 'True'):
            qs = qs.filter(active=True)

        unit_type = params.get('unit_type')
        if unit_type:
            unit_type = unit_type.upper()
            if unit_type not in UNIT_TYPES:
                raise ValidationError({'unit_type': f'Use one of {", ".join(sorted(UNIT_TYPES))}.'})
            qs = qs.filter(unit_type=unit_type)

        parent = params.get('parent')
        if parent:
            if not parent.isdigit():
                raise ValidationError({'parent': 'Must be a unit id.'})
            qs = qs.filter(parent_id=int(parent))

        search = params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(code_short__icontains=search))

        return qs.order_by('unit_type', 'name')

    @action(detail=True, methods=['get'])
    def stations(self, request, pk=None):
        province = self.get_object()
        if province.unit_type != 'PROVINCIAL_HQ':
            raise ValidationError({'detail': f'{province.name} is not a provincial command centre.'})
        qs = self.get_queryset().filter(parent=province, unit_type='STATION').order_by('name')
        return Response(self.get_serializer(qs, many=True).data)
