from django.contrib import admin
from django import forms
from django.utils.html import format_html

from .models import (
    Inmate,
    NextOfKin,
    InmateStationHistory,
    InmateClassificationHistory,
    Offence,
    Convicted,
    Unconvicted,
    Restitution,
    CourtSession,
    RestitutionExtension,
    # ReleaseHistory,
    InmatePropertyHistory,
    EscapeHistory,
    InmateDisciplinaryHistory,
    # InmateMedicalHistory,
    InmateDocument,
    InmateAuditTrail,
)


# ==================================================
# INLINE DEFINITIONS (HISTORICAL – READ-ONLY BY DESIGN)
# ==================================================


class NextOfKinInline(admin.TabularInline):
    model = NextOfKin
    extra = 0


class StationHistoryInline(admin.TabularInline):
    model = InmateStationHistory
    extra = 0
    ordering = ("-date_admitted",)
    autocomplete_fields = ("station",)


class ClassificationHistoryInline(admin.TabularInline):
    model = InmateClassificationHistory
    extra = 0
    ordering = ("-effective_date",)


class OffenceInline(admin.TabularInline):
    model = Offence
    extra = 0

class CourtSessionInline(admin.TabularInline):
    model = CourtSession
    extra = 0
    ordering = ("-session_date",)

class RestitutionExtensionInline(admin.TabularInline):
    model = RestitutionExtension
    extra = 0
    ordering = ("-date_extended",)


# class UnconvictedInline(admin.TabularInline):
#     model = Unconvicted
#     extra = 0
#     ordering = ("-next_court_date",)


# class ConvictedInline(admin.StackedInline):
#     model = Convicted
#     extra = 0
#     max_num = 1


# class RestitutionInline(admin.TabularInline):
#     model = Restitution
#     extra = 0


# class ReleaseInline(admin.TabularInline):
#     model = ReleaseHistory
#     extra = 0
#     readonly_fields = ("document",)


class PropertyInline(admin.TabularInline):
    model = InmatePropertyHistory
    extra = 0


class EscapeInline(admin.TabularInline):
    model = EscapeHistory
    extra = 0


class DisciplinaryInline(admin.TabularInline):
    model = InmateDisciplinaryHistory
    extra = 0


# class MedicalInline(admin.TabularInline):
#     model = InmateMedicalHistory
#     extra = 0


class DocumentInline(admin.TabularInline):
    model = InmateDocument
    extra = 0
    readonly_fields = ("uploaded_at",)


class AuditTrailInline(admin.TabularInline):
    model = InmateAuditTrail
    extra = 0
    can_delete = False
    readonly_fields = ("action", "performed_by", "timestamp", "remarks")
    ordering = ("-timestamp",)

    def has_add_permission(self, request, obj=None):
        return False


# ==================================================
# INMATE ADMIN (CORE ENTITY)
# ==================================================
@admin.register(Inmate)
class InmateAdmin(admin.ModelAdmin):
    list_display = (
        "prison_number",
        "admission_type",
        "surname",
        "first_name",
        "gender",
        "marital_status",
        "nationality",
        "current_status",
        "admission_date",
    )
    list_filter = (
        "gender",
        "current_status",
        "nationality",
        "admission_date",
    )
    search_fields = (
        "prison_number",
        "first_name",
        "surname",
        "national_id",
        "crb_number",
    )
    ordering = ("-admission_date",)
    date_hierarchy = "admission_date"

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    fieldsets = (
        ("Identification", {
            "fields": (
                "admission_type",
                "prison_number",
                "crb_number",
                "national_id",
            )
        }),
        ("Personal Details", {
            "fields": (
                "first_name",
                "surname",
                "other_names",
                "gender",
                "marital_status",
                "date_of_birth",
                "nationality",
            )
        }),
        ("Custody Status", {
            "fields": (
                "admission_date",
                "current_status",
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
        StationHistoryInline,
        ClassificationHistoryInline,
        NextOfKinInline,
        OffenceInline,
        # UnconvictedInline,
        # ConvictedInline,
        # RestitutionInline,
        # ReleaseInline,
        PropertyInline,
        EscapeInline,
        DisciplinaryInline,
        # MedicalInline,
        DocumentInline,
        AuditTrailInline,
    )

    def has_delete_permission(self, request, obj=None):
        # Inmates must never be deleted – legal record
        return False


# ==================================================
# STANDALONE ADMINS (LIMITED / READ-ONLY)
# ==================================================

@admin.register(Offence)
class OffenceAdmin(admin.ModelAdmin):
    list_display = ("inmate", "court", "date_charged", "Offence_status")
    list_filter = ("Offence_status", "court")
    search_fields = ("inmate__surname", "court")
    autocomplete_fields = ("inmate",)
    inlines = [CourtSessionInline]

@admin.register(Convicted)
class ConvictedAdmin(admin.ModelAdmin):
    list_display = ("offence", "sentence", "date_of_sentence")
    

@admin.register(Unconvicted)
class UnconvictedAdmin(admin.ModelAdmin):
    list_display = ("offence", "next_court_date")


@admin.register(Restitution)
class RestitutionAdmin(admin.ModelAdmin):
    list_display = ("offence", "inmate", "restitution_amount", "restitution_date", "alternative_restitution_sentence")
    autocomplete_fields = ("inmate", "offence")
    inlines = [RestitutionExtensionInline]
    fields = (
        "inmate",
        "offence",
        "restitution_amount",
        "restitution_date",
        "alternative_restitution_sentence",
        "status",
        "receipt",
    )

    class RestitutionAdminForm(forms.ModelForm):
        class Meta:
            model = Restitution
            fields = "__all__"

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            # Default to no offences until inmate is chosen
            self.fields["offence"].queryset = Offence.objects.none()

            inmate_id = None
            # When adding/changing: prefer bound form data
            if "inmate" in self.data:
                try:
                    inmate_id = int(self.data.get("inmate"))
                except (TypeError, ValueError):
                    inmate_id = None
            # Fallback to instance value when editing existing restitution
            elif getattr(self.instance, "pk", None) and getattr(self.instance, "inmate_id", None):
                inmate_id = self.instance.inmate_id

            if inmate_id:
                self.fields["offence"].queryset = Offence.objects.filter(inmate_id=inmate_id)

    form = RestitutionAdminForm



@admin.register(InmateDocument)
class InmateDocumentAdmin(admin.ModelAdmin):
    list_display = ("inmate", "document_type", "uploaded_at")
    search_fields = ("inmate__surname", "document_type")
    readonly_fields = ("uploaded_at",)


@admin.register(InmateAuditTrail)
class InmateAuditTrailAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "inmate", "action", "performed_by")
    search_fields = ("inmate__surname", "action", "performed_by")
    ordering = ("-timestamp",)
    readonly_fields = ("inmate", "action", "performed_by", "timestamp", "remarks")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
