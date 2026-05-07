"""
Health Application URLs
========================
REST API endpoints for comprehensive health records management.
All endpoints implement station-level data isolation.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PatientViewSet,
    AdmissionHealthAssessmentViewSet,
    OutPatientVisitViewSet,
    MentalHealthVisitViewSet,
    ChronicPatientViewSet,
    MedicineViewSet,
    StockCardEntryViewSet,
    MedicalEquipmentViewSet,
    EquipmentUsageLogViewSet,
    HealthAuditTrailViewSet,
)

# Create router and register ViewSets
router = DefaultRouter()

# Patient management
router.register(r'patients', PatientViewSet, basename='patient')

# Medical registers
router.register(r'admission-assessments', AdmissionHealthAssessmentViewSet, basename='admission-assessment')
router.register(r'opd-visits', OutPatientVisitViewSet, basename='opd-visit')
router.register(r'mental-health-visits', MentalHealthVisitViewSet, basename='mental-health-visit')
router.register(r'chronic-patients', ChronicPatientViewSet, basename='chronic-patient')

# Pharmacy management
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'stock-card-entries', StockCardEntryViewSet, basename='stock-card-entry')

# Equipment management
router.register(r'medical-equipment', MedicalEquipmentViewSet, basename='medical-equipment')
router.register(r'equipment-usage', EquipmentUsageLogViewSet, basename='equipment-usage')

# Audit trail
router.register(r'health-audit', HealthAuditTrailViewSet, basename='health-audit')

urlpatterns = [
    path('', include(router.urls)),
]

