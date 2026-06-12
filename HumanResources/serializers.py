"""
Human resources app serializers
===============================
Professional DRF serializers for officer and HR domain.
"""

from rest_framework import serializers

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


class OfficerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Officer
        fields = "__all__"
        read_only_fields = ["service_number", "created_at", "updated_at"]


class MaritalStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaritalStatus
        fields = "__all__"


class RankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rank
        fields = "__all__"


class QualificationTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualificationType
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = "__all__"


class OfficerStationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerStationHistory
        fields = "__all__"

    def create(self, validated_data):
        request = self.context.get('request')
        org_unit = getattr(request, 'org_unit', None) if request else None
        if not org_unit and request and hasattr(request.user, 'id'):
            from Auth.utils import get_current_org_unit
            org_unit = get_current_org_unit(request.user)

        if 'posting_org_unit' not in validated_data:
            validated_data['posting_org_unit'] = org_unit

        return super().create(validated_data)


class OfficerRankHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerRankHistory
        fields = "__all__"


class OfficerQualificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerQualification
        fields = "__all__"


class OfficerCourseHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerCourseHistory
        fields = "__all__"


class OffenceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = OffenceType
        fields = "__all__"


class ChargeSheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChargeSheet
        fields = "__all__"


class SentenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sentence
        fields = "__all__"


class DependantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dependant
        fields = "__all__"


class OfficerDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerDocument
        fields = "__all__"
        read_only_fields = ["uploaded_at"]


class OfficerAuditTrailSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerAuditTrail
        fields = "__all__"
        read_only_fields = ["timestamp"]


