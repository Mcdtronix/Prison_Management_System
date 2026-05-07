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


