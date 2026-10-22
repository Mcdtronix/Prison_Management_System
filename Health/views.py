"""
Health Application Views
========================
Professional DRF ViewSets for comprehensive health records management.
Implements station-level data isolation and RBAC permissions.
"""

from rest_framework import viewsets, status
from Core.mixins import OrgUnitContextMixin

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.db.models import Q

from Auth.permissions import IsHealthOfficer, IsStationDataOwner
from Auth.utils import (
    get_user_operational_context,
    get_current_station,
)
from Auth.models import Station
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
from .serializers import (
    PatientSerializer,
    PatientListSerializer,
    AdmissionHealthAssessmentSerializer,
    OutPatientVisitSerializer,
    MentalHealthVisitSerializer,
    ChronicPatientSerializer,
    MedicineSerializer,
    StockCardEntrySerializer,
    MedicalEquipmentSerializer,
    EquipmentUsageLogSerializer,
    HealthAuditTrailSerializer,
)


def get_health_queryset_for_user(request, base_queryset, station_field="station"):
    """
    Scope health querysets according to user's organizational context.
    - Superusers & National HQ: view all stations (or filter by ?station=)
    - Provincial HQ: view all child stations in their province
    - Station users: view only their assigned station
    - Unassigned / no station: empty queryset
    """
    org_unit, user_station = get_user_operational_context(request)
    query_params = getattr(request, 'query_params', getattr(request, 'GET', {}))
    station_param = query_params.get('station', None)

    # 1. Superuser or National HQ
    if request.user.is_superuser or (org_unit and org_unit.unit_type == 'NATIONAL_HQ'):
        if station_param:
            return base_queryset.filter(**{f"{station_field}_id": station_param})
        return base_queryset

    # 2. Provincial Command
    if org_unit and org_unit.unit_type == 'PROVINCIAL_HQ':
        visible_units = getattr(request, 'visible_org_units', None)
        if visible_units is not None:
            station_codes = [u.code_short for u in visible_units]
            child_stations = Station.objects.filter(code__in=station_codes)
            qs = base_queryset.filter(**{f"{station_field}__in": child_stations})
            if station_param:
                qs = qs.filter(**{f"{station_field}_id": station_param})
            return qs

    # 3. Station user
    if user_station:
        return base_queryset.filter(**{f"{station_field}": user_station})

    # 4. Fallback / unassigned: deny visibility
    return base_queryset.none()


def save_health_record_with_station(request, serializer, station_field="station"):
    """
    Attach operational station on save.
    Station users get their assigned station automatically.
    Headquarters users must explicitly specify a station in validated_data.
    """
    org_unit, user_station = get_user_operational_context(request)
    station = serializer.validated_data.get(station_field) or user_station

    if not station:
        raise ValidationError({
            station_field: "An operational prison station is required for medical records. Headquarters users must specify a station."
        })

    kwargs = {station_field: station}
    model = serializer.Meta.model
    model_fields = {f.name for f in model._meta.get_fields()}
    if org_unit and 'owner_org_unit' in model_fields:
        if not serializer.validated_data.get('owner_org_unit'):
            kwargs['owner_org_unit'] = org_unit

    serializer.save(**kwargs)


# ==================================================
# PATIENT VIEWS
# ==================================================
class PatientViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for patient management with station isolation"""
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        """Filter patients by user's station/organizational context"""
        base_qs = Patient.objects.select_related(
            'inmate', 'officer', 'dependent', 'station', 'owner_org_unit'
        )
        queryset = get_health_queryset_for_user(self.request, base_qs)
        inmate_id = self.request.query_params.get('inmate', None)
        if inmate_id is not None:
            queryset = queryset.filter(inmate_id=inmate_id)
        return queryset

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)

    def get_serializer_class(self):
        """Use list serializer for list actions"""
        if self.action == 'list':
            return PatientListSerializer
        return PatientSerializer

    @action(detail=True, methods=['get'])
    def medical_history(self, request, pk=None):
        """Get comprehensive medical history for a patient"""
        patient = self.get_object()
        data = {
            'patient': PatientSerializer(patient).data,
            'admission_assessments': AdmissionHealthAssessmentSerializer(
                patient.admission_assessments.all(), many=True
            ).data,
            'opd_visits': OutPatientVisitSerializer(
                patient.opd_visits.all(), many=True
            ).data,
            'mental_health_visits': MentalHealthVisitSerializer(
                patient.mental_health_visits.all(), many=True
            ).data,
            'chronic_record': ChronicPatientSerializer(
                patient.chronic_patient_record
            ).data if hasattr(patient, 'chronic_patient_record') else None,
        }
        return Response(data)


# ==================================================
# MEDICAL REGISTER VIEWS
# ==================================================
class AdmissionHealthAssessmentViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for inmate admission health assessments"""
    queryset = AdmissionHealthAssessment.objects.all()
    serializer_class = AdmissionHealthAssessmentSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = AdmissionHealthAssessment.objects.select_related('inmate', 'station')
        queryset = get_health_queryset_for_user(self.request, base_qs)
        inmate_id = self.request.query_params.get('inmate', None)
        if inmate_id is not None:
            queryset = queryset.filter(inmate_id=inmate_id)
        return queryset

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


class OutPatientVisitViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for OPD consultations"""
    queryset = OutPatientVisit.objects.all()
    serializer_class = OutPatientVisitSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = OutPatientVisit.objects.select_related('patient', 'station')
        queryset = get_health_queryset_for_user(self.request, base_qs)
        inmate_id = self.request.query_params.get('inmate', None)
        if inmate_id is not None:
            queryset = queryset.filter(patient__inmate_id=inmate_id)
        return queryset

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


class MentalHealthVisitViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for mental health consultations"""
    queryset = MentalHealthVisit.objects.all()
    serializer_class = MentalHealthVisitSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = MentalHealthVisit.objects.select_related('patient', 'station')
        return get_health_queryset_for_user(self.request, base_qs)

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


class ChronicPatientViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for chronic patient management"""
    queryset = ChronicPatient.objects.all()
    serializer_class = ChronicPatientSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = ChronicPatient.objects.select_related('patient', 'station')
        return get_health_queryset_for_user(self.request, base_qs)

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


# ==================================================
# PHARMACY VIEWS
# ==================================================
class MedicineViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for medicine inventory management"""
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    @action(detail=True, methods=['get'])
    def stock_history(self, request, pk=None):
        """Get stock card history for a medicine"""
        medicine = self.get_object()
        user_station = get_current_station(request.user)
        stock_entries = StockCardEntry.objects.filter(medicine=medicine)
        if user_station:
            stock_entries = stock_entries.filter(station=user_station)
        stock_entries = stock_entries.order_by('-entry_date')[:50]
        serializer = StockCardEntrySerializer(stock_entries, many=True)
        return Response(serializer.data)


class StockCardEntryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for stock card register"""
    queryset = StockCardEntry.objects.all()
    serializer_class = StockCardEntrySerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = StockCardEntry.objects.select_related('medicine', 'station')
        return get_health_queryset_for_user(self.request, base_qs)

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


# ==================================================
# EQUIPMENT VIEWS
# ==================================================
class MedicalEquipmentViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for medical equipment management"""
    queryset = MedicalEquipment.objects.all()
    serializer_class = MedicalEquipmentSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer, IsStationDataOwner]

    def get_queryset(self):
        base_qs = MedicalEquipment.objects.select_related('station')
        return get_health_queryset_for_user(self.request, base_qs)

    def perform_create(self, serializer):
        save_health_record_with_station(self.request, serializer)


class EquipmentUsageLogViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for equipment usage tracking"""
    queryset = EquipmentUsageLog.objects.all()
    serializer_class = EquipmentUsageLogSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        base_qs = EquipmentUsageLog.objects.select_related('equipment')
        return get_health_queryset_for_user(self.request, base_qs, station_field="equipment__station")


# ==================================================
# AUDIT VIEWS
# ==================================================
class HealthAuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for health audit trails"""
    queryset = HealthAuditTrail.objects.all()
    serializer_class = HealthAuditTrailSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter audit logs by user's station and role permissions"""
        base_qs = HealthAuditTrail.objects.order_by('-timestamp')
        return get_health_queryset_for_user(self.request, base_qs)
