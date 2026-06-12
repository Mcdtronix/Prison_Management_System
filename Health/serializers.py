"""
Health Application Serializers
==============================
Professional DRF serializers for comprehensive health records management.
Supports all patient types and medical registers with proper validation.
"""

from rest_framework import serializers
from django.utils import timezone

from .models import (
    Patient,
    AdmissionHealthAssessment,
    OutPatientVisit,
    MentalHealthVisit,
    ChronicPatient,
    Medicine,
    StockCardEntry,
    MedicalEquipment,
    EquipmentUsageLog,
    HealthAuditTrail,
)


# ==================================================
# PATIENT SERIALIZERS
# ==================================================
class PatientSerializer(serializers.ModelSerializer):
    """Serializer for patient records with computed fields"""
    name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    identifier = serializers.ReadOnlyField()

    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "name", "age", "identifier"]

    def validate(self, data):
        """Ensure station context for data isolation"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            # Phase 1: set owner_org_unit from request context (middleware) or user assignment
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            data['owner_org_unit'] = org_unit
        return data


class PatientListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for patient lists"""
    name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    identifier = serializers.ReadOnlyField()

    class Meta:
        model = Patient
        fields = ["id", "patient_type", "name", "age", "identifier", "station", "created_at"]


# ==================================================
# MEDICAL REGISTER SERIALIZERS
# ==================================================
class AdmissionHealthAssessmentSerializer(serializers.ModelSerializer):
    """Serializer for inmate admission health assessments"""
    inmate_name = serializers.ReadOnlyField(source='inmate.surname')
    inmate_prison_number = serializers.ReadOnlyField(source='inmate.prison_number')

    class Meta:
        model = AdmissionHealthAssessment
        fields = "__all__"
        read_only_fields = ["id", "bmi", "inmate_name", "inmate_prison_number"]

    def validate(self, data):
        """Auto-calculate BMI and set station"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            data['owner_org_unit'] = org_unit
        return data


class OutPatientVisitSerializer(serializers.ModelSerializer):
    """Serializer for OPD consultations"""
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_age = serializers.ReadOnlyField(source='patient.age')
    patient_identifier = serializers.ReadOnlyField(source='patient.identifier')

    class Meta:
        model = OutPatientVisit
        fields = "__all__"
        read_only_fields = ["id", "patient_name", "patient_age", "patient_identifier"]

    def validate_blood_pressure(self, value):
        """Validate BP format"""
        import re
        if not re.match(r'^\d{2,3}/\d{2,3}$', value):
            raise serializers.ValidationError("Blood pressure must be in format systolic/diastolic (e.g., 120/80)")
        return value

    def validate(self, data):
        """Set station from request"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            data['owner_org_unit'] = org_unit
        return data


class MentalHealthVisitSerializer(serializers.ModelSerializer):
    """Serializer for mental health consultations"""
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_age = serializers.ReadOnlyField(source='patient.age')
    patient_identifier = serializers.ReadOnlyField(source='patient.identifier')

    class Meta:
        model = MentalHealthVisit
        fields = "__all__"
        read_only_fields = ["id", "patient_name", "patient_age", "patient_identifier"]

    def validate(self, data):
        """Set station from request"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            # Chronic patient linked via Patient; ensure owner org is propagated on patient creation
            data['owner_org_unit'] = org_unit
        return data


class ChronicPatientSerializer(serializers.ModelSerializer):
    """Serializer for chronic patient management"""
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_age = serializers.ReadOnlyField(source='patient.age')
    patient_identifier = serializers.ReadOnlyField(source='patient.identifier')
    patient_address = serializers.ReadOnlyField(source='patient.address')
    patient_phone = serializers.ReadOnlyField(source='patient.phone_number')

    class Meta:
        model = ChronicPatient
        fields = "__all__"
        read_only_fields = ["id", "patient_name", "patient_age", "patient_identifier", "patient_address", "patient_phone"]

    def validate(self, data):
        """Set station from request"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
        return data


# ==================================================
# PHARMACY SERIALIZERS
# ==================================================
class MedicineSerializer(serializers.ModelSerializer):
    """Serializer for medicine inventory"""
    class Meta:
        model = Medicine
        fields = "__all__"
        read_only_fields = ["id"]


class StockCardEntrySerializer(serializers.ModelSerializer):
    """Serializer for stock card register entries"""
    medicine_name = serializers.ReadOnlyField(source='medicine.medicine_name')
    medicine_strength = serializers.ReadOnlyField(source='medicine.strength')

    class Meta:
        model = StockCardEntry
        fields = "__all__"
        read_only_fields = ["id", "medicine_name", "medicine_strength"]

    def validate(self, data):
        """Validate stock calculations and set station"""
        # Ensure only one transaction type
        transaction_types = [
            data.get('quantity_received', 0) > 0,
            data.get('quantity_issued', 0) > 0,
            data.get('adjustment', 0) != 0,
            data.get('losses', 0) > 0
        ]
        if sum(transaction_types) != 1:
            raise serializers.ValidationError("Each entry must have exactly one type of transaction")

        # Validate balance calculation
        expected_balance = (
            data['balance_brought_forward'] +
            data.get('quantity_received', 0) -
            data.get('quantity_issued', 0) +
            data.get('adjustment', 0) -
            data.get('losses', 0)
        )
        if expected_balance != data['balance']:
            raise serializers.ValidationError("Balance does not match calculated value")

        # Set station from request
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            # Stock card entries belong to station/org unit
            data['owner_org_unit'] = org_unit

        return data


# ==================================================
# EQUIPMENT SERIALIZERS
# ==================================================
class MedicalEquipmentSerializer(serializers.ModelSerializer):
    """Serializer for medical equipment inventory"""
    class Meta:
        model = MedicalEquipment
        fields = "__all__"
        read_only_fields = ["id"]

    def validate(self, data):
        """Set station from request"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'userprofile'):
            data['station'] = request.user.userprofile.station
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
            data['owner_org_unit'] = org_unit
        return data


class EquipmentUsageLogSerializer(serializers.ModelSerializer):
    """Serializer for equipment usage tracking"""
    equipment_name = serializers.ReadOnlyField(source='equipment.equipment_name')

    class Meta:
        model = EquipmentUsageLog
        fields = "__all__"
        read_only_fields = ["id", "equipment_name"]

    def validate(self, data):
        """Validate return date logic"""
        if data.get('returned') and not data.get('return_date'):
            raise serializers.ValidationError("Return date must be provided if equipment is returned")
        if data.get('return_date') and data['return_date'] < data['usage_date']:
            raise serializers.ValidationError("Return date cannot be before usage date")
        return data


# ==================================================
# AUDIT SERIALIZERS
# ==================================================
class HealthAuditTrailSerializer(serializers.ModelSerializer):
    """Serializer for health audit logging"""
    class Meta:
        model = HealthAuditTrail
        fields = "__all__"
        read_only_fields = ["id", "timestamp"]
