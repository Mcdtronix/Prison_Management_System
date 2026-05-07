from django.contrib import admin
from django.core.exceptions import ValidationError
from .models import (
    Officer,
    MaritalStatus,
    Rank,
    QualificationType,
    Course,
    OfficerStationHistory,
    OfficerRankHistory,
    OfficerQualification,
    OfficerCourseHistory,
    OffenceType,
    ChargeSheet,
    Sentence,
    Dependant,
    OfficerDocument,
    OfficerAuditTrail,
)


# ==================================================
# INLINE DEFINITIONS (HISTORICAL / TRANSACTIONAL)
# ==================================================

class OfficerStationHistoryInline(admin.TabularInline):
    model = OfficerStationHistory
    extra = 0
    ordering = ("-date_posted",)
    autocomplete_fields = ("station",)


class OfficerRankHistoryInline(admin.TabularInline):
    model = OfficerRankHistory
    extra = 0
    ordering = ("-effective_date",)
    autocomplete_fields = ("rank",)


class OfficerQualificationInline(admin.TabularInline):
    model = OfficerQualification
    extra = 0
    autocomplete_fields = ("qualification_type",)
    readonly_fields = ("certificate",)


class OfficerCourseInline(admin.TabularInline):
    model = OfficerCourseHistory
    extra = 0
    autocomplete_fields = ("course",)
    readonly_fields = ("certificate",)


class ChargeSheetInline(admin.TabularInline):
    model = ChargeSheet
    extra = 0
    autocomplete_fields = ("offence_type",)
    readonly_fields = ("document",)


class SentenceInline(admin.StackedInline):
    model = Sentence
    extra = 0


class DependantInline(admin.TabularInline):
    model = Dependant
    extra = 0
    readonly_fields = ("birth_certificate",)


class DocumentInline(admin.TabularInline):
    model = OfficerDocument
    extra = 0
    readonly_fields = ("uploaded_at",)


class OfficerAuditTrailInline(admin.TabularInline):
    model = OfficerAuditTrail
    extra = 0
    can_delete = False
    readonly_fields = ("action", "performed_by", "timestamp", "remarks")
    ordering = ("-timestamp",)

    def has_add_permission(self, request, obj=None):
        return False


# ==================================================
# OFFICER ADMIN (CORE ENTITY)
# ==================================================
@admin.register(Officer)
class OfficerAdmin(admin.ModelAdmin):
    list_display = (
        "service_number",
        "surname",
        "first_name",
        "gender",
        "current_status",
        "date_of_attestation",
    )
    list_filter = (
        "gender",
        "current_status",
        "date_of_attestation",
    )
    search_fields = (
        "service_number",
        "surname",
        "first_name",
        "national_id",
    )
    ordering = ("surname", "first_name")

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        ("Service Identity", {
            "fields": (
                "service_number",
                "current_status",
            )
        }),
        ("Personal Details", {
            "fields": (
                "first_name",
                "surname",
                "other_names",
                "gender",
                "date_of_birth",
                "national_id",
            )
        }),
        ("Service Lifecycle", {
            "fields": (
                "date_of_attestation",
                "date_of_retirement",
            )
        }),
        ("Audit Metadata", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )

    inlines = (
        OfficerStationHistoryInline,
        OfficerRankHistoryInline,
        OfficerQualificationInline,
        OfficerCourseInline,
        ChargeSheetInline,
        DependantInline,
        DocumentInline,
        OfficerAuditTrailInline,
    )

    def has_delete_permission(self, request, obj=None):
        # Officers are permanent service records
        return False

    def save_model(self, request, obj, form, change):
        # Ensure service_number is entered
        if not obj.service_number:
            raise ValidationError("Service number is required and must follow format: 2934823Z")
        super().save_model(request, obj, form, change)


# ==================================================
# REFERENCE / LOOKUP ADMINS
# ==================================================

@admin.register(Rank)
class RankAdmin(admin.ModelAdmin):
    list_display = ("name", "rank_level")
    ordering = ("rank_level",)
    search_fields = ("name",)


@admin.register(QualificationType)
class QualificationTypeAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "issuing_authority")
    search_fields = ("name", "category")


@admin.register(OffenceType)
class OffenceTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "severity_level")
    search_fields = ("name",)


# ==================================================
# DISCIPLINARY ADMINS (LIMITED MUTABILITY)
# ==================================================

@admin.register(ChargeSheet)
class ChargeSheetAdmin(admin.ModelAdmin):
    list_display = ("officer", "offence_type", "charge_date", "status")
    list_filter = ("status",)
    search_fields = ("officer__service_number", "officer__surname")
    autocomplete_fields = ("officer", "offence_type")
    readonly_fields = ("document",)
    inlines = [SentenceInline]


@admin.register(Sentence)
class SentenceAdmin(admin.ModelAdmin):
    list_display = ("charge_sheet", "sentence_type", "sentence_date", "duration_months")
    readonly_fields = ()


# ==================================================
# DOCUMENT & AUDIT ADMINS (READ-ONLY)
# ==================================================

@admin.register(OfficerDocument)
class OfficerDocumentAdmin(admin.ModelAdmin):
    list_display = ("officer", "document_type", "uploaded_at")
    search_fields = ("officer__service_number", "document_type")
    readonly_fields = ("uploaded_at",)


@admin.register(OfficerAuditTrail)
class OfficerAuditTrailAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "officer", "action", "performed_by")
    ordering = ("-timestamp",)
    search_fields = ("officer__service_number", "action", "performed_by")
    readonly_fields = ("officer", "action", "performed_by", "timestamp", "remarks")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
