from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    InmateViewSet,
    NextOfKinViewSet,
    InmateStationHistoryViewSet,
    InmateClassificationHistoryViewSet,
    OffenceViewSet,
    ConvictedViewSet,
    UnconvictedViewSet,
    RestitutionViewSet,
    CourtSessionViewSet,
    RestitutionExtensionViewSet,
    InmateRegistrationView,
    OffenceRegistrationView,
    PendingAdminApprovalView,
    PendingOffenceRegistrationView,
    # ReleaseHistoryViewSet,
    InmatePropertyHistoryViewSet,
    EscapeHistoryViewSet,
    InmateDisciplinaryHistoryViewSet,
    # InmateMedicalHistoryViewSet,
    InmateDocumentViewSet,
    InmateAuditTrailViewSet,
    InmateListView,
)

router = DefaultRouter()
router.register(r'inmates', InmateViewSet)
router.register(r'next-of-kin', NextOfKinViewSet)
router.register(r'station-history', InmateStationHistoryViewSet)
router.register(r'classification-history', InmateClassificationHistoryViewSet)
router.register(r'offences', OffenceViewSet)
router.register(r'convicted', ConvictedViewSet)
router.register(r'court-appearances', UnconvictedViewSet)
router.register(r'restitution', RestitutionViewSet)
router.register(r'court-sessions', CourtSessionViewSet)
router.register(r'restitution-extensions', RestitutionExtensionViewSet)
# router.register(r'releases', ReleaseHistoryViewSet)
router.register(r'property-history', InmatePropertyHistoryViewSet)
router.register(r'escape-history', EscapeHistoryViewSet)
router.register(r'disciplinary-history', InmateDisciplinaryHistoryViewSet)
# router.register(r'medical-history', InmateMedicalHistoryViewSet)
router.register(r'documents', InmateDocumentViewSet)
router.register(r'audit-trail', InmateAuditTrailViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('register/', InmateRegistrationView.as_view(), name='basic-inmate-registration'),
    path('register-offences/', OffenceRegistrationView.as_view(), name='offence-registration'),
    path('pending-approval/', PendingAdminApprovalView.as_view(), name='pending-admin-approval'),
    path('pending-offences/', PendingOffenceRegistrationView.as_view(), name='pending-offence-registration'),
    path('inmate-list/', InmateListView.as_view(), name='inmate-list'),
]
