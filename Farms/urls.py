from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FarmProjectViewSet,
    CropTypeViewSet,
    CropCycleViewSet,
    CropInputUsageViewSet,
    CropOutputViewSet,
    AnimalTypeViewSet,
    LivestockBatchViewSet,
    LivestockEventViewSet,
    FarmRevenueViewSet,
    FarmExpenseViewSet,
)

router = DefaultRouter()
router.register(r'projects', FarmProjectViewSet)
router.register(r'crop-types', CropTypeViewSet)
router.register(r'crop-cycles', CropCycleViewSet)
router.register(r'crop-input-usage', CropInputUsageViewSet)
router.register(r'crop-output', CropOutputViewSet)
router.register(r'animal-types', AnimalTypeViewSet)
router.register(r'livestock-batches', LivestockBatchViewSet)
router.register(r'livestock-events', LivestockEventViewSet)
router.register(r'farm-revenue', FarmRevenueViewSet)
router.register(r'farm-expense', FarmExpenseViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

