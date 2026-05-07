from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    OfficerViewSet,
    MaritalStatusViewSet,
    RankViewSet,
    QualificationTypeViewSet,
    CourseViewSet,
    OfficerStationHistoryViewSet,
    OfficerRankHistoryViewSet,
    OfficerQualificationViewSet,
    OfficerCourseHistoryViewSet,
    OffenceTypeViewSet,
    ChargeSheetViewSet,
    SentenceViewSet,
    DependantViewSet,
    OfficerDocumentViewSet,
    OfficerAuditTrailViewSet,
)

router = DefaultRouter()
router.register(r'officers', OfficerViewSet)
router.register(r'marital-statuses', MaritalStatusViewSet)
router.register(r'ranks', RankViewSet)
router.register(r'qualification-types', QualificationTypeViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'station-history', OfficerStationHistoryViewSet)
router.register(r'rank-history', OfficerRankHistoryViewSet)
router.register(r'qualifications', OfficerQualificationViewSet)
router.register(r'courses-history', OfficerCourseHistoryViewSet)
router.register(r'offence-types', OffenceTypeViewSet)
router.register(r'charge-sheets', ChargeSheetViewSet)
router.register(r'sentences', SentenceViewSet)
router.register(r'dependants', DependantViewSet)
router.register(r'documents', OfficerDocumentViewSet)
router.register(r'audit-trail', OfficerAuditTrailViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

