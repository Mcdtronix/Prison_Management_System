from rest_framework import serializers

from .models import CaseFile, IncidentReport, CourtDate


class CaseFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseFile
        fields = ('id', 'reference', 'title', 'description', 'owner_org_unit', 'created_by', 'created_at')
        read_only_fields = ('created_by', 'created_at')


class IncidentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentReport
        fields = ('id', 'case', 'occurred_at', 'reported_by', 'summary', 'details', 'severity', 'owner_org_unit', 'created_at')
        read_only_fields = ('created_at',)


class CourtDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourtDate
        fields = ('id', 'case', 'scheduled_for', 'location', 'notes', 'owner_org_unit', 'created_at')
        read_only_fields = ('created_at',)
