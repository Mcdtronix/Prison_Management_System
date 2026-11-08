from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin, StationScopedMixin, by_officer, by_units

from rest_framework.permissions import IsAuthenticated
from Auth.permissions import FarmsRecords, ReadOnlyOr

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


class FarmProjectViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmProject.objects.select_related("supervising_officer")
    serializer_class = FarmProjectSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('owner_org_unit')


class CropTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropType.objects.all()
    serializer_class = CropTypeSerializer
    permission_classes = [IsAuthenticated, ReadOnlyOr.of('farms.access')]


class CropCycleViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropCycle.objects.select_related("project", "crop_type")
    serializer_class = CropCycleSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('project__owner_org_unit')


class CropInputUsageViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropInputUsage.objects.select_related("crop_cycle", "input_item")
    serializer_class = CropInputUsageSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('crop_cycle__project__owner_org_unit')


class CropOutputViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropOutput.objects.select_related("crop_cycle")
    serializer_class = CropOutputSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('crop_cycle__project__owner_org_unit')


class AnimalTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = AnimalType.objects.all()
    serializer_class = AnimalTypeSerializer
    permission_classes = [IsAuthenticated, ReadOnlyOr.of('farms.access')]


class LivestockBatchViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockBatch.objects.select_related("animal_type")
    serializer_class = LivestockBatchSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]


class LivestockEventViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockEvent.objects.select_related("batch")
    serializer_class = LivestockEventSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]


class FarmRevenueViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmRevenue.objects.select_related("project")
    serializer_class = FarmRevenueSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('project__owner_org_unit')


class FarmExpenseViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmExpense.objects.select_related("project")
    serializer_class = FarmExpenseSerializer
    permission_classes = [IsAuthenticated, FarmsRecords]
    scope_rule = by_units('project__owner_org_unit')
