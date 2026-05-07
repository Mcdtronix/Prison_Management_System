from rest_framework import viewsets
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


class OfficerViewSet(viewsets.ModelViewSet):
    queryset = Officer.objects.all()
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated]


class MaritalStatusViewSet(viewsets.ModelViewSet):
    queryset = MaritalStatus.objects.all()
    serializer_class = MaritalStatusSerializer
    permission_classes = [IsAuthenticated]


class RankViewSet(viewsets.ModelViewSet):
    queryset = Rank.objects.all()
    serializer_class = RankSerializer
    permission_classes = [IsAuthenticated]


class QualificationTypeViewSet(viewsets.ModelViewSet):
    queryset = QualificationType.objects.all()
    serializer_class = QualificationTypeSerializer
    permission_classes = [IsAuthenticated]


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]


class OfficerStationHistoryViewSet(viewsets.ModelViewSet):
    queryset = OfficerStationHistory.objects.select_related("officer", "station")
    serializer_class = OfficerStationHistorySerializer
    permission_classes = [IsAuthenticated]


class OfficerRankHistoryViewSet(viewsets.ModelViewSet):
    queryset = OfficerRankHistory.objects.select_related("officer", "rank")
    serializer_class = OfficerRankHistorySerializer
    permission_classes = [IsAuthenticated]


class OfficerQualificationViewSet(viewsets.ModelViewSet):
    queryset = OfficerQualification.objects.select_related("officer", "qualification_type")
    serializer_class = OfficerQualificationSerializer
    permission_classes = [IsAuthenticated]


class OfficerCourseHistoryViewSet(viewsets.ModelViewSet):
    queryset = OfficerCourseHistory.objects.select_related("officer", "course")
    serializer_class = OfficerCourseHistorySerializer
    permission_classes = [IsAuthenticated]


class OffenceTypeViewSet(viewsets.ModelViewSet):
    queryset = OffenceType.objects.all()
    serializer_class = OffenceTypeSerializer
    permission_classes = [IsAuthenticated]


class ChargeSheetViewSet(viewsets.ModelViewSet):
    queryset = ChargeSheet.objects.select_related("officer", "offence_type")
    serializer_class = ChargeSheetSerializer
    permission_classes = [IsAuthenticated]


class SentenceViewSet(viewsets.ModelViewSet):
    queryset = Sentence.objects.select_related("charge_sheet")
    serializer_class = SentenceSerializer
    permission_classes = [IsAuthenticated]


class DependantViewSet(viewsets.ModelViewSet):
    queryset = Dependant.objects.select_related("officer")
    serializer_class = DependantSerializer
    permission_classes = [IsAuthenticated]


class OfficerDocumentViewSet(viewsets.ModelViewSet):
    queryset = OfficerDocument.objects.select_related("officer")
    serializer_class = OfficerDocumentSerializer
    permission_classes = [IsAuthenticated]


class OfficerAuditTrailViewSet(viewsets.ModelViewSet):
    queryset = OfficerAuditTrail.objects.select_related("officer")
    serializer_class = OfficerAuditTrailSerializer
    permission_classes = [IsAuthenticated]
