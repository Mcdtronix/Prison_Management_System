from rest_framework import serializers
from .models import ReportTemplate

class ReportTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ReportTemplate
        fields = ['id', 'name', 'description', 'created_by', 'created_by_name', 'base_model', 'selected_fields', 'filters', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
