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
    CourtSessionViewSet,
    UpcomingCourtSessionsView,
    ScheduleCourtSessionView,
    ReceptionAnalyticsView,
    UpcomingDischargesView,
    RestitutionViewSet,
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
    ReclassificationViewSet,
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
router.register(r'reclassifications', ReclassificationViewSet, basename='reclassifications')

urlpatterns = [
    path('court-sessions/upcoming/', UpcomingCourtSessionsView.as_view(), name='upcoming-court-sessions'),
    path('court-sessions/schedule/', ScheduleCourtSessionView.as_view(), name='schedule-court-session'),
    path('register/', InmateRegistrationView.as_view(), name='basic-inmate-registration'),
    path('register-offences/', OffenceRegistrationView.as_view(), name='offence-registration'),
    path('pending-approval/', PendingAdminApprovalView.as_view(), name='pending-admin-approval'),
    path('pending-offences/', PendingOffenceRegistrationView.as_view(), name='pending-offence-registration'),
    path('inmate-list/', InmateListView.as_view(), name='inmate-list'),
    path('analytics/', ReceptionAnalyticsView.as_view(), name='reception-analytics'),
    path('discharges/upcoming/', UpcomingDischargesView.as_view(), name='upcoming-discharges'),
    path('', include(router.urls)),
]
