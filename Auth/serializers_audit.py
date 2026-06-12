from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='user.username', read_only=True)
    station_code = serializers.CharField(source='station.code', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor_username', 'role', 'station_code', 'action', 'module', 'object_type', 'object_id',
            'ip_address', 'user_agent', 'request_method', 'request_path', 'remarks', 'timestamp'
        ]
        read_only_fields = fields
