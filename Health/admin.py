"""
Health Application Admin Interface
==================================
Django Admin configuration for comprehensive health records management.
Implements station-level data isolation and audit trails.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse

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
# INLINE DEFINITIONS (CLINICAL / HISTORICAL)
# ==================================================

class AdmissionAssessmentInline(admin.TabularInline):
    model = AdmissionHealthAssessment
    extra = 0
    ordering = ("-assessment_date",)
    readonly_fields = ("bmi",)


class OPDVisitInline(admin.TabularInline):
    model = OutPatientVisit
    extra = 0
    ordering = ("-visit_date",)


class MentalHealthVisitInline(admin.TabularInline):
    model = MentalHealthVisit
    extra = 0
    ordering = ("-visit_date",)


class ChronicPatientInline(admin.TabularInline):
    model = ChronicPatient
    extra = 0
    ordering = ("-registration_date",)


class StockCardEntryInline(admin.TabularInline):
    model = StockCardEntry
    extra = 0
    ordering = ("-entry_date",)
    readonly_fields = ("balance",)


class EquipmentUsageLogInline(admin.TabularInline):
    model = EquipmentUsageLog
    extra = 0
    ordering = ("-usage_date",)


# ==================================================
# PATIENT ADMIN (ABSTRACTION ROOT)
# ==================================================
@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "patient_type",
        "name",
        "age",
        "identifier",
        "station",
        "created_at",
    )
    list_filter = ("patient_type", "station")
    ordering = ("-created_at",)
    search_fields = ("inmate__prison_number", "officer__service_number", "full_name")

    readonly_fields = ("created_at", "updated_at", "name", "age", "identifier")

    fieldsets = (
        ("Patient Information", {
            "fields": ("patient_type", "station")
        }),
        ("Linked Entities", {
            "fields": ("inmate", "officer", "dependent"),
            "classes": ("collapse",)
        }),
        ("Manual Entry (Community/Ex-Service)", {
            "fields": ("full_name", "date_of_birth", "gender", "address", "phone_number", "service_number"),
            "classes": ("collapse",)
        }),
        ("Audit Information", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    inlines = (
        OPDVisitInline,
        MentalHealthVisitInline,
        ChronicPatientInline,
    )

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs

    def has_delete_permission(self, request, obj=None):
        # Medical patient records must never be deleted
        return False


# ==================================================
# ADMISSION HEALTH ASSESSMENT
# ==================================================
@admin.register(AdmissionHealthAssessment)
class AdmissionHealthAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "inmate",
        "assessment_date",
        "weight",
        "height",
        "bmi",
        "is_chronic_patient",
        "assessed_by",
        "station",
    )
    list_filter = ("is_chronic_patient", "station")
    ordering = ("-assessment_date",)
    date_hierarchy = "assessment_date"
    search_fields = ("inmate__prison_number", "assessed_by")
    readonly_fields = ("bmi",)

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


# ==================================================
# OPD VISITS
# ==================================================
@admin.register(OutPatientVisit)
class OutPatientVisitAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "visit_date",
        "temperature",
        "blood_pressure",
        "diagnosis",
        "attended_by",
        "station",
    )
    list_filter = ("follow_up_required", "station")
    date_hierarchy = "visit_date"
    search_fields = ("patient__inmate__prison_number", "attended_by", "diagnosis")

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


# ==================================================
# MENTAL HEALTH VISITS
# ==================================================
@admin.register(MentalHealthVisit)
class MentalHealthVisitAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "visit_date",
        "place_of_reference",
        "reason",
        "outcome",
        "attended_by",
        "station",
    )
    list_filter = ("follow_up_required", "station")
    date_hierarchy = "visit_date"
    search_fields = ("patient__inmate__prison_number", "attended_by", "reason")

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


# ==================================================
# CHRONIC PATIENTS
# ==================================================
@admin.register(ChronicPatient)
class ChronicPatientAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "medication_collection_date",
        "medication_types",
        "registered_by",
        "station",
    )
    list_filter = ("station",)
    date_hierarchy = "registration_date"
    search_fields = ("patient__inmate__prison_number", "registered_by", "medication_types")

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


# ==================================================
# PHARMACY / MEDICINE ADMINS
# ==================================================
@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = (
        "medicine_name",
        "strength",
        "dosage_form",
        "unit_of_measure",
        "reorder_level",
    )
    search_fields = ("medicine_name", "strength")
    inlines = (StockCardEntryInline,)


@admin.register(StockCardEntry)
class StockCardEntryAdmin(admin.ModelAdmin):
    list_display = (
        "medicine",
        "entry_date",
        "quantity_received",
        "quantity_issued",
        "balance",
        "recorded_by",
        "station",
    )
    list_filter = ("station",)
    date_hierarchy = "entry_date"
    search_fields = ("medicine__medicine_name", "recorded_by")
    readonly_fields = ("balance",)

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


# ==================================================
# MEDICAL EQUIPMENT
# ==================================================
@admin.register(MedicalEquipment)
class MedicalEquipmentAdmin(admin.ModelAdmin):
    list_display = (
        "equipment_name",
        "serial_number",
        "condition",
        "location",
        "station",
    )
    list_filter = ("condition", "station")
    search_fields = ("equipment_name", "serial_number")
    inlines = (EquipmentUsageLogInline,)

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(station=request.user.userprofile.station)
        return qs


@admin.register(EquipmentUsageLog)
class EquipmentUsageLogAdmin(admin.ModelAdmin):
    list_display = (
        "equipment",
        "used_by",
        "usage_date",
        "returned",
        "return_date",
    )
    list_filter = ("returned",)
    ordering = ("-usage_date",)
    search_fields = ("equipment__equipment_name", "used_by")

    def get_queryset(self, request):
        """Filter by user's station"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(equipment__station=request.user.userprofile.station)
        return qs


# ==================================================
# HEALTH AUDIT TRAIL (READ-ONLY)
# ==================================================
@admin.register(HealthAuditTrail)
class HealthAuditTrailAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "action",
        "performed_by",
        "remarks",
    )
    list_filter = ("action",)
    ordering = ("-timestamp",)
    search_fields = ("performed_by", "action", "remarks")
    readonly_fields = (
        "action",
        "performed_by",
        "timestamp",
        "remarks",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_queryset(self, request):
        """Filter audit logs by user's station (if applicable)"""
        qs = super().get_queryset(request)
        # Add station filtering logic if audit model includes station
        return qs
