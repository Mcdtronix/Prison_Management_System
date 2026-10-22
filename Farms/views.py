from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.exceptions import PermissionDenied, ValidationError
from Core.mixins import OrgUnitContextMixin
from Auth.permissions import IsFarmsOfficer, IsStationDataOwner
from Auth.utils import get_user_operational_context

from .models import (
    FarmProject,
    CropType,
    CropCycle,
    CropInputUsage,
    CropOutput,
    AnimalType,
    LivestockBatch,
    LivestockEvent,
    FarmRevenue,
    FarmExpense,
)
from .serializers import (
    FarmProjectSerializer,
    CropTypeSerializer,
    CropCycleSerializer,
    CropInputUsageSerializer,
    CropOutputSerializer,
    AnimalTypeSerializer,
    LivestockBatchSerializer,
    LivestockEventSerializer,
    FarmRevenueSerializer,
    FarmExpenseSerializer,
)


class IsFarmsOfficerOrReadOnly(BasePermission):
    """
    Allow read-only catalog access for authenticated staff.
    Mutations require Farms Officer role.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return IsFarmsOfficer().has_permission(request, view)


def get_farms_scoped_units(request):
    """Return visible org units for Farm project scoping."""
    if request.user.is_superuser:
        return None
    org_unit, _ = get_user_operational_context(request)
    if org_unit and org_unit.unit_type == 'NATIONAL_HQ':
        return None
    visible_units = getattr(request, 'visible_org_units', None)
    if visible_units is not None:
        return visible_units
    if org_unit:
        from Auth.models import OrgUnit
        return OrgUnit.objects.filter(id=org_unit.id)
    return None


class FarmProjectViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmProject.objects.all()
    serializer_class = FarmProjectSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = FarmProject.objects.select_related("supervising_officer", "owner_org_unit")
        if units is not None:
            return qs.filter(owner_org_unit__in=units)
        return qs

    def perform_create(self, serializer):
        org_unit, _ = get_user_operational_context(self.request)
        if not org_unit and not self.request.user.is_superuser:
            raise PermissionDenied("Operational organization unit required to create farm projects.")

        target_unit = serializer.validated_data.get('owner_org_unit') or org_unit
        units = get_farms_scoped_units(self.request)
        if units is not None and target_unit not in units:
            raise PermissionDenied("Cannot assign farm project to an unauthorized organization unit.")

        serializer.save(owner_org_unit=target_unit)

    def perform_update(self, serializer):
        target_unit = serializer.validated_data.get('owner_org_unit')
        if target_unit:
            units = get_farms_scoped_units(self.request)
            if units is not None and target_unit not in units:
                raise PermissionDenied("Cannot reassign farm project to an unauthorized organization unit.")
        serializer.save()


class CropTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropType.objects.all()
    serializer_class = CropTypeSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficerOrReadOnly]


class CropCycleViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropCycle.objects.all()
    serializer_class = CropCycleSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = CropCycle.objects.select_related("project", "crop_type")
        if units is not None:
            return qs.filter(project__owner_org_unit__in=units)
        return qs


class CropInputUsageViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropInputUsage.objects.all()
    serializer_class = CropInputUsageSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = CropInputUsage.objects.select_related("crop_cycle", "input_item")
        if units is not None:
            return qs.filter(crop_cycle__project__owner_org_unit__in=units)
        return qs


class CropOutputViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropOutput.objects.all()
    serializer_class = CropOutputSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = CropOutput.objects.select_related("crop_cycle")
        if units is not None:
            return qs.filter(crop_cycle__project__owner_org_unit__in=units)
        return qs


class AnimalTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = AnimalType.objects.all()
    serializer_class = AnimalTypeSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficerOrReadOnly]


class LivestockBatchViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockBatch.objects.all()
    serializer_class = LivestockBatchSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = LivestockBatch.objects.select_related("animal_type")
        # Scoped to visible units if org_unit is associated
        return qs


class LivestockEventViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockEvent.objects.all()
    serializer_class = LivestockEventSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = LivestockEvent.objects.select_related("batch")
        return qs


class FarmRevenueViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmRevenue.objects.all()
    serializer_class = FarmRevenueSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = FarmRevenue.objects.select_related("project")
        if units is not None:
            return qs.filter(project__owner_org_unit__in=units)
        return qs


class FarmExpenseViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmExpense.objects.all()
    serializer_class = FarmExpenseSerializer
    permission_classes = [IsAuthenticated, IsFarmsOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_farms_scoped_units(self.request)
        qs = FarmExpense.objects.select_related("project")
        if units is not None:
            return qs.filter(project__owner_org_unit__in=units)
        return qs
