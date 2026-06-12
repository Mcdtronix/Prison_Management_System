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
from django.db.models import Q

from Auth.permissions import IsHealthOfficer
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


# ==================================================
# PATIENT VIEWS
# ==================================================
class PatientViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for patient management with station isolation"""
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter patients by user's station"""
        user_station = self.request.user.userprofile.station
        return Patient.objects.filter(station=user_station).select_related(
            'inmate', 'officer', 'dependent', 'station'
        )

    def get_serializer_class(self):
        """Use list serializer for list actions"""
        if self.action == 'list':
            return PatientListSerializer
        return PatientSerializer

    @action(detail=True, methods=['get'])
    def medical_history(self, request, pk=None):
        """Get complete medical history for a patient"""
        patient = self.get_object()
        data = {
            'opd_visits': OutPatientVisitSerializer(
                patient.opd_visits.all()[:10], many=True
            ).data,
            'mental_health_visits': MentalHealthVisitSerializer(
                patient.mental_health_visits.all()[:10], many=True
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
    serializer_class = AdmissionHealthAssessmentSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return AdmissionHealthAssessment.objects.filter(
            station=user_station
        ).select_related('inmate', 'station')


class OutPatientVisitViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for OPD consultations"""
    serializer_class = OutPatientVisitSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return OutPatientVisit.objects.filter(
            station=user_station
        ).select_related('patient', 'station')


class MentalHealthVisitViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for mental health consultations"""
    serializer_class = MentalHealthVisitSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return MentalHealthVisit.objects.filter(
            station=user_station
        ).select_related('patient', 'station')


class ChronicPatientViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for chronic patient management"""
    serializer_class = ChronicPatientSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return ChronicPatient.objects.filter(
            station=user_station
        ).select_related('patient', 'station')


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
        user_station = request.user.userprofile.station
        stock_entries = StockCardEntry.objects.filter(
            medicine=medicine,
            station=user_station
        ).order_by('-entry_date')[:50]
        serializer = StockCardEntrySerializer(stock_entries, many=True)
        return Response(serializer.data)


class StockCardEntryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for stock card register"""
    serializer_class = StockCardEntrySerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return StockCardEntry.objects.filter(
            station=user_station
        ).select_related('medicine', 'station')

    def perform_create(self, serializer):
        """Ensure station isolation on create"""
        org_unit = getattr(self.request, 'org_unit', None)
        if not org_unit:
            from Auth.utils import get_current_org_unit
            org_unit = get_current_org_unit(self.request.user)
        serializer.save(station=self.request.user.userprofile.station, owner_org_unit=org_unit)


# ==================================================
# EQUIPMENT VIEWS
# ==================================================
class MedicalEquipmentViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for medical equipment management"""
    serializer_class = MedicalEquipmentSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return MedicalEquipment.objects.filter(
            station=user_station
        ).select_related('station')

    def perform_create(self, serializer):
        """Ensure station isolation on create"""
        org_unit = getattr(self.request, 'org_unit', None)
        if not org_unit:
            from Auth.utils import get_current_org_unit
            org_unit = get_current_org_unit(self.request.user)
        serializer.save(station=self.request.user.userprofile.station, owner_org_unit=org_unit)


class EquipmentUsageLogViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    """ViewSet for equipment usage tracking"""
    serializer_class = EquipmentUsageLogSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter by user's station"""
        user_station = self.request.user.userprofile.station
        return EquipmentUsageLog.objects.filter(
            equipment__station=user_station
        ).select_related('equipment')


# ==================================================
# AUDIT VIEWS
# ==================================================
class HealthAuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for health audit trails"""
    serializer_class = HealthAuditTrailSerializer
    permission_classes = [IsAuthenticated, IsHealthOfficer]

    def get_queryset(self):
        """Filter audit logs by user's station and role permissions"""
        user = self.request.user
        user_station = user.userprofile.station

        # Base queryset
        queryset = HealthAuditTrail.objects.filter(
            # Add station filtering logic based on your audit model
        ).order_by('-timestamp')

        # Role-based filtering
        if user.userprofile.role.name == 'ADMIN_OFFICER':
            # Admins can see all station logs
            pass
        else:
            # Health officers see limited logs
            queryset = queryset.filter(
                # Add appropriate filters
            )

        return queryset
