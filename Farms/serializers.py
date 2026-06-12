"""
Farms app serializers
=====================
Professional DRF serializers for farms and agricultural production domain.
"""

from rest_framework import serializers

from .models import (
    FarmProject,
    CropType,
    CropCycle,
    CropInputUsage,
    CropOutput,
    AnimalType,
    LivestockBatch,
    LivestockEvent,
    FarmRevenue,
    FarmExpense,
)


class FarmProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmProject
        fields = "__all__"

    def create(self, validated_data):
        request = self.context.get('request')
        org_unit = getattr(request, 'org_unit', None) if request else None
        if not org_unit and request and hasattr(request.user, 'id'):
            from Auth.utils import get_current_org_unit
            org_unit = get_current_org_unit(request.user)

        if 'owner_org_unit' not in validated_data:
            validated_data['owner_org_unit'] = org_unit

        return super().create(validated_data)


class CropTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropType
        fields = "__all__"


class CropCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropCycle
        fields = "__all__"


class CropInputUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropInputUsage
        fields = "__all__"


class CropOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropOutput
        fields = "__all__"


class AnimalTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnimalType
        fields = "__all__"


class LivestockBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = LivestockBatch
        fields = "__all__"


class LivestockEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = LivestockEvent
        fields = "__all__"


class FarmRevenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmRevenue
        fields = "__all__"


class FarmExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmExpense
        fields = "__all__"


