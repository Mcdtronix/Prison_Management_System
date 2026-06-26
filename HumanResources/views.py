from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated

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

class OfficerViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Officer.objects.all()
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        officer = serializer.save()
        try:
            # Try to get the admin's station to post the officer there initially
            station = None
            
            # 1. Try to get station from primary assignment
            from Auth.utils import get_primary_assignment
            assignment = get_primary_assignment(self.request.user)
            if assignment and assignment.org_unit and assignment.org_unit.unit_type == "STATION":
                from Auth.models import Station
                station = Station.objects.filter(org_unit=assignment.org_unit).first()
                
            # 2. Fallback to userprofile
            if not station and hasattr(self.request.user, 'userprofile') and self.request.user.userprofile.station:
                station = self.request.user.userprofile.station
            
            if station:
                from .models import OfficerStationHistory
                OfficerStationHistory.objects.create(
                    officer=officer,
                    station=station,
                    date_posted=officer.date_of_attestation,
                    posted_by=self.request.user.username
                )
        except Exception as e:
            import logging
            logging.error(f"Failed to create station history for new officer: {e}")


class MaritalStatusViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = MaritalStatus.objects.all()
    serializer_class = MaritalStatusSerializer
    permission_classes = [IsAuthenticated]


class RankViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Rank.objects.all()
    serializer_class = RankSerializer
    permission_classes = [IsAuthenticated]


class QualificationTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = QualificationType.objects.all()
    serializer_class = QualificationTypeSerializer
    permission_classes = [IsAuthenticated]


class CourseViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]


class OfficerStationHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerStationHistory.objects.select_related("officer", "station")
    serializer_class = OfficerStationHistorySerializer
    permission_classes = [IsAuthenticated]


class OfficerRankHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerRankHistory.objects.select_related("officer", "rank")
    serializer_class = OfficerRankHistorySerializer
    permission_classes = [IsAuthenticated]


class OfficerQualificationViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerQualification.objects.select_related("officer", "qualification_type")
    serializer_class = OfficerQualificationSerializer
    permission_classes = [IsAuthenticated]


class OfficerCourseHistoryViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerCourseHistory.objects.select_related("officer", "course")
    serializer_class = OfficerCourseHistorySerializer
    permission_classes = [IsAuthenticated]


class OffenceTypeViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OffenceType.objects.all()
    serializer_class = OffenceTypeSerializer
    permission_classes = [IsAuthenticated]


class ChargeSheetViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = ChargeSheet.objects.select_related("officer", "offence_type")
    serializer_class = ChargeSheetSerializer
    permission_classes = [IsAuthenticated]


class SentenceViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Sentence.objects.select_related("charge_sheet")
    serializer_class = SentenceSerializer
    permission_classes = [IsAuthenticated]


class DependantViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Dependant.objects.select_related("officer")
    serializer_class = DependantSerializer
    permission_classes = [IsAuthenticated]


class OfficerDocumentViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerDocument.objects.select_related("officer")
    serializer_class = OfficerDocumentSerializer
    permission_classes = [IsAuthenticated]


class OfficerAuditTrailViewSet(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerAuditTrail.objects.select_related("officer")
    serializer_class = OfficerAuditTrailSerializer
    permission_classes = [IsAuthenticated]
