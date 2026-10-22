from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, BasePermission
from Core.mixins import OrgUnitContextMixin
from Auth.permissions import IsHROfficer, IsStationDataOwner
from Auth.utils import get_user_operational_context, get_current_station
from Auth.models import Station
from django.utils import timezone

from .models import (
    Officer,
    MaritalStatus,
    Rank,
    QualificationType,
    Course,
    OfficerStationHistory,
    OfficerRankHistory,
    OfficerQualification,
    OfficerCourseHistory,
    OffenceType,
    ChargeSheet,
    Sentence,
    Dependant,
    OfficerDocument,
    OfficerAuditTrail,
)
from .serializers import (
    OfficerSerializer,
    MaritalStatusSerializer,
    RankSerializer,
    QualificationTypeSerializer,
    CourseSerializer,
    OfficerStationHistorySerializer,
    OfficerRankHistorySerializer,
    OfficerQualificationSerializer,
    OfficerCourseHistorySerializer,
    OffenceTypeSerializer,
    ChargeSheetSerializer,
    SentenceSerializer,
    DependantSerializer,
    OfficerDocumentSerializer,
    OfficerAuditTrailSerializer,
)


class IsHROfficerOrReadOnly(BasePermission):
    """
    Allow read-only access to reference catalogs for authenticated users.
    Mutations require HR Officer role.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return IsHROfficer().has_permission(request, view)


def get_hr_officer_queryset(request, base_queryset):
    """
    Scope officers according to the actor's organizational unit.
    - Superusers & National HQ: view all officers nationwide
    - Provincial Command: view officers currently posted to child stations within province
    - Station HR: view officers currently posted to user's station
    - Others / unassigned: empty queryset
    """
    if request.user.is_superuser:
        return base_queryset

    org_unit, user_station = get_user_operational_context(request)
    today = timezone.now().date()

    # 1. National HQ
    if org_unit and org_unit.unit_type == 'NATIONAL_HQ':
        return base_queryset

    # 2. Provincial Command
    if org_unit and org_unit.unit_type == 'PROVINCIAL_HQ':
        visible_units = getattr(request, 'visible_org_units', None)
        if visible_units is not None:
            station_codes = [u.code_short for u in visible_units]
            child_stations = Station.objects.filter(code__in=station_codes)
            return base_queryset.filter(
                station_history__station__in=child_stations,
                station_history__date_posted__lte=today,
                station_history__date_transferred__isnull=True
            ).distinct()

    # 3. Station user
    if user_station:
        return base_queryset.filter(
            station_history__station=user_station,
            station_history__date_posted__lte=today,
            station_history__date_transferred__isnull=True
        ).distinct()

    return base_queryset.none()


class OfficerFilterMixin:
    """
    Ensures subordinate records are scoped to officers accessible to the requesting user.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        officer_id = self.request.query_params.get('officer', None)
        if officer_id is not None:
            if hasattr(self.queryset.model, 'officer'):
                queryset = queryset.filter(officer_id=officer_id)

        # Enforce organizational boundary on child records
        if hasattr(self.queryset.model, 'officer'):
            visible_officers = get_hr_officer_queryset(self.request, Officer.objects.all())
            queryset = queryset.filter(officer__in=visible_officers)
        return queryset


class OfficerViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Officer.objects.all()
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]

    def get_queryset(self):
        return get_hr_officer_queryset(self.request, Officer.objects.all())

    def perform_create(self, serializer):
        officer = serializer.save()
        try:
            org_unit, station = get_user_operational_context(self.request)
            if station:
                OfficerStationHistory.objects.create(
                    officer=officer,
                    station=station,
                    posting_org_unit=org_unit,
                    date_posted=officer.date_of_attestation,
                    posted_by=self.request.user.username
                )
        except Exception as e:
            import logging
            logging.error(f"Failed to create station history for new officer: {e}")


# =====================================================
# REFERENCE / LOOKUP TABLES
# =====================================================
class MaritalStatusViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = MaritalStatus.objects.all()
    serializer_class = MaritalStatusSerializer
    permission_classes = [IsAuthenticated, IsHROfficerOrReadOnly]


class RankViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Rank.objects.all()
    serializer_class = RankSerializer
    permission_classes = [IsAuthenticated, IsHROfficerOrReadOnly]


class QualificationTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = QualificationType.objects.all()
    serializer_class = QualificationTypeSerializer
    permission_classes = [IsAuthenticated, IsHROfficerOrReadOnly]


class CourseViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsHROfficerOrReadOnly]


class OffenceTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OffenceType.objects.all()
    serializer_class = OffenceTypeSerializer
    permission_classes = [IsAuthenticated, IsHROfficerOrReadOnly]


# =====================================================
# HISTORICAL / TRANSACTIONAL VIEWS
# =====================================================
class OfficerStationHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerStationHistory.objects.select_related("officer", "station")
    serializer_class = OfficerStationHistorySerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class OfficerRankHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerRankHistory.objects.select_related("officer", "rank")
    serializer_class = OfficerRankHistorySerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class OfficerQualificationViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerQualification.objects.select_related("officer", "qualification_type")
    serializer_class = OfficerQualificationSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class OfficerCourseHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerCourseHistory.objects.select_related("officer", "course")
    serializer_class = OfficerCourseHistorySerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class ChargeSheetViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = ChargeSheet.objects.select_related("officer", "offence_type")
    serializer_class = ChargeSheetSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class SentenceViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Sentence.objects.select_related("charge_sheet__officer")
    serializer_class = SentenceSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]

    def get_queryset(self):
        visible_officers = get_hr_officer_queryset(self.request, Officer.objects.all())
        return Sentence.objects.filter(charge_sheet__officer__in=visible_officers).select_related("charge_sheet__officer")


class DependantViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Dependant.objects.select_related("officer")
    serializer_class = DependantSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class OfficerDocumentViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerDocument.objects.select_related("officer")
    serializer_class = OfficerDocumentSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]


class OfficerAuditTrailViewSet(OfficerFilterMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail for officer record modifications."""
    queryset = OfficerAuditTrail.objects.select_related("officer")
    serializer_class = OfficerAuditTrailSerializer
    permission_classes = [IsAuthenticated, IsHROfficer, IsStationDataOwner]
