from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from Core.mixins import OrgUnitContextMixin, StationScopedMixin, by_officer

from rest_framework.permissions import IsAuthenticated
from Auth.permissions import HRRecords, ReadOnlyOr

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



class OfficerFilterMixin:
    def get_queryset(self):
        queryset = super().get_queryset()
        officer_id = self.request.query_params.get('officer', None)
        if officer_id is not None:
            if hasattr(self.queryset.model, 'officer'):
                queryset = queryset.filter(officer_id=officer_id)
        return queryset


# Reference lists every screen reads; only HR and account administrators change them.
HRReferenceList = ReadOnlyOr.of('hr.change', 'users.manage')


class OfficerRecordViewSet(OfficerFilterMixin, StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    """Service records about one officer: visible and changeable only for officers in the user's scope.

    The officer is checked before saving (a new posting may legitimately move
    them elsewhere), instead of the mixin's after-save check.
    """
    permission_classes = [IsAuthenticated, HRRecords]
    scope_rule = by_officer('officer')

    def _officer_of(self, serializer):
        data = serializer.validated_data
        if 'officer' in data:
            return data['officer']
        if 'charge_sheet' in data:
            return getattr(data['charge_sheet'], 'officer', None)
        instance = serializer.instance
        if instance is not None:
            return getattr(instance, 'officer', None) or getattr(getattr(instance, 'charge_sheet', None), 'officer', None)
        return None

    def _require_officer_in_scope(self, serializer):
        from Auth.scoping import officers_in_scope
        from .models import Officer
        officer = self._officer_of(serializer)
        scope = self.get_scope()
        if scope.everywhere:
            return
        if officer is None or not officers_in_scope(Officer.objects.filter(pk=officer.pk), scope).exists():
            raise PermissionDenied({
                "error_code": "STATION_MISMATCH",
                "message": "You do not have permission to modify this record.",
                "details": "This officer is not at your station.",
                "resolution": "If you require access, please contact the administrators.",
            })

    def perform_create(self, serializer):
        self._require_officer_in_scope(serializer)
        OrgUnitContextMixin.perform_create(self, serializer)

    def perform_update(self, serializer):
        self._require_officer_in_scope(serializer)
        serializer.save()


class OfficerViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Officer.objects.all()
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated, HRRecords]

    def get_queryset(self):
        # Only officers currently at the requester's station (or below).
        # Officers elsewhere 404, so they cannot be opened by URL either.
        from Auth.scoping import officers_in_scope, people_scope
        return officers_in_scope(super().get_queryset(), people_scope(self.request.user))

    def _posting_for_creator(self):
        """(org unit, old station) where a new officer is posted: the creator's own station.

        An officer's station comes only from their open posting, so an officer
        saved without one belongs to no station and shows in nobody's list.
        """
        from Auth.scoping import units_for_legacy_station
        from Auth.utils import get_primary_assignment, legacy_station_for_unit

        user = self.request.user
        assignment = get_primary_assignment(user)
        if assignment and assignment.org_unit and assignment.org_unit.unit_type == "STATION":
            unit = assignment.org_unit
            # Stations made in the console may have no old row yet: create it.
            return unit, legacy_station_for_unit(unit, create=True)

        profile = getattr(user, 'userprofile', None)  # older accounts: their profile's station
        if profile is not None and profile.station_id:
            unit_ids = units_for_legacy_station(profile.station)
            from Auth.models import OrgUnit
            unit = OrgUnit.objects.filter(pk__in=unit_ids).first() if unit_ids else None
            return unit, profile.station
        return None, None

    def perform_create(self, serializer):
        from django.db import transaction
        from rest_framework.exceptions import ValidationError
        from .models import OfficerStationHistory

        posting_unit, station = self._posting_for_creator()
        if station is None:
            # Refuse rather than save an officer no station can see.
            raise ValidationError({'detail': 'New officers are posted to the station of the account adding them, '
                                             'and this account is not at a station. Add the officer from the '
                                             'console, choosing their station.'})
        with transaction.atomic():  # officer and posting are saved together, or not at all
            officer = serializer.save()
            OfficerStationHistory.objects.create(
                officer=officer,
                station=station,
                posting_org_unit=posting_unit,
                date_posted=officer.date_of_attestation,
                posted_by=self.request.user.username,
            )


class MaritalStatusViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = MaritalStatus.objects.all()
    serializer_class = MaritalStatusSerializer
    permission_classes = [IsAuthenticated, HRReferenceList]


class RankViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Rank.objects.all()
    serializer_class = RankSerializer
    permission_classes = [IsAuthenticated, HRReferenceList]


class QualificationTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = QualificationType.objects.all()
    serializer_class = QualificationTypeSerializer
    permission_classes = [IsAuthenticated, HRReferenceList]


class CourseViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, HRReferenceList]


class OfficerStationHistoryViewSet(OfficerRecordViewSet):
    queryset = OfficerStationHistory.objects.select_related("officer", "station")
    serializer_class = OfficerStationHistorySerializer


class OfficerRankHistoryViewSet(OfficerRecordViewSet):
    queryset = OfficerRankHistory.objects.select_related("officer", "rank")
    serializer_class = OfficerRankHistorySerializer


class OfficerQualificationViewSet(OfficerRecordViewSet):
    queryset = OfficerQualification.objects.select_related("officer", "qualification_type")
    serializer_class = OfficerQualificationSerializer


class OfficerCourseHistoryViewSet(OfficerRecordViewSet):
    queryset = OfficerCourseHistory.objects.select_related("officer", "course")
    serializer_class = OfficerCourseHistorySerializer


class OffenceTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OffenceType.objects.all()
    serializer_class = OffenceTypeSerializer
    permission_classes = [IsAuthenticated, HRReferenceList]


class ChargeSheetViewSet(OfficerRecordViewSet):
    queryset = ChargeSheet.objects.select_related("officer", "offence_type")
    serializer_class = ChargeSheetSerializer


class SentenceViewSet(OfficerRecordViewSet):
    queryset = Sentence.objects.select_related("charge_sheet")
    serializer_class = SentenceSerializer
    scope_rule = by_officer('charge_sheet__officer')


class DependantViewSet(OfficerRecordViewSet):
    queryset = Dependant.objects.select_related("officer")
    serializer_class = DependantSerializer


class OfficerDocumentViewSet(OfficerRecordViewSet):
    queryset = OfficerDocument.objects.select_related("officer")
    serializer_class = OfficerDocumentSerializer


class OfficerAuditTrailViewSet(OfficerFilterMixin, StationScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only: audit entries are written by the system, never through the API."""
    queryset = OfficerAuditTrail.objects.select_related("officer")
    serializer_class = OfficerAuditTrailSerializer
    permission_classes = [IsAuthenticated, HRRecords]
    scope_rule = by_officer('officer')
