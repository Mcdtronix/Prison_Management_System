from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated

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


class FarmProjectViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmProject.objects.select_related("supervising_officer")
    serializer_class = FarmProjectSerializer
    permission_classes = [IsAuthenticated]


class CropTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropType.objects.all()
    serializer_class = CropTypeSerializer
    permission_classes = [IsAuthenticated]


class CropCycleViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropCycle.objects.select_related("project", "crop_type")
    serializer_class = CropCycleSerializer
    permission_classes = [IsAuthenticated]


class CropInputUsageViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropInputUsage.objects.select_related("crop_cycle", "input_item")
    serializer_class = CropInputUsageSerializer
    permission_classes = [IsAuthenticated]


class CropOutputViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CropOutput.objects.select_related("crop_cycle")
    serializer_class = CropOutputSerializer
    permission_classes = [IsAuthenticated]


class AnimalTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = AnimalType.objects.all()
    serializer_class = AnimalTypeSerializer
    permission_classes = [IsAuthenticated]


class LivestockBatchViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockBatch.objects.select_related("animal_type")
    serializer_class = LivestockBatchSerializer
    permission_classes = [IsAuthenticated]


class LivestockEventViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = LivestockEvent.objects.select_related("batch")
    serializer_class = LivestockEventSerializer
    permission_classes = [IsAuthenticated]


class FarmRevenueViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmRevenue.objects.select_related("project")
    serializer_class = FarmRevenueSerializer
    permission_classes = [IsAuthenticated]


class FarmExpenseViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FarmExpense.objects.select_related("project")
    serializer_class = FarmExpenseSerializer
    permission_classes = [IsAuthenticated]
