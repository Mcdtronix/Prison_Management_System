from rest_framework import serializers

from .catalogue import SOURCES, can_use
from .engine import MAX_COLUMNS
from .models import ReportTemplate


class ReportTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()

    class Meta:
        model = ReportTemplate
        fields = [
            "id", "name", "description", "base_model", "source_label", "selected_fields", "filters", "sort",
            "created_by", "created_by_name", "is_owner", "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.id == obj.created_by_id)

    def get_source_label(self, obj):
        source = SOURCES.get(obj.base_model)
        return source.label if source else obj.base_model

    def validate(self, data):
        source_key = data.get("base_model", getattr(self.instance, "base_model", None))
        source = SOURCES.get(source_key or "")
        request = self.context.get("request")
        if source is None:
            raise serializers.ValidationError({"base_model": "Unknown report source."})
        if request and not can_use(request.user, source):
            raise serializers.ValidationError({"base_model": "Your role does not have access to this report."})

        columns = data.get("selected_fields", getattr(self.instance, "selected_fields", None)) or []
        if not columns:
            raise serializers.ValidationError({"selected_fields": "Choose at least one column."})
        if len(columns) > MAX_COLUMNS or len(set(columns)) != len(columns):
            raise serializers.ValidationError({"selected_fields": "Columns must be unique, at most 40."})
        unknown = [c for c in columns if source.column(c) is None]
        if unknown:
            raise serializers.ValidationError({"selected_fields": f"Not columns of {source.label}: {', '.join(unknown)}"})

        for item in data.get("sort") or []:
            if source.column((item or {}).get("key")) is None or (item or {}).get("direction") not in ("asc", "desc"):
                raise serializers.ValidationError({"sort": "Sort by a column of this report, asc or desc."})
        return data
