from django.contrib import admin
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

# ==================================================
# FARM PROJECTS
# ==================================================
@admin.register(FarmProject)
class FarmProjectAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "start_date",
        "expected_end_date",
        "supervising_officer",
        "status",
    )
    list_filter = ("status", "start_date")
    search_fields = (
        "name",
        "supervising_officer__service_number",
    )
    ordering = ("-start_date",)


# ==================================================
# CROPS
# ==================================================
@admin.register(CropType)
class CropTypeAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


class CropInputUsageInline(admin.TabularInline):
    model = CropInputUsage
    extra = 0
    readonly_fields = ("usage_date",)


class CropOutputInline(admin.TabularInline):
    model = CropOutput
    extra = 0
    readonly_fields = ("date_recorded",)


@admin.register(CropCycle)
class CropCycleAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "crop_type",
        "planting_date",
        "expected_harvest_date",
        "actual_harvest_date",
        "area_planted_hectares",
    )
    list_filter = (
        "crop_type",
        "planting_date",
        "expected_harvest_date",
    )
    search_fields = (
        "project__name",
        "crop_type__name",
    )
    inlines = [CropInputUsageInline, CropOutputInline]
    ordering = ("-planting_date",)


@admin.register(CropInputUsage)
class CropInputUsageAdmin(admin.ModelAdmin):
    list_display = (
        "crop_cycle",
        "input_item",
        "quantity_used",
        "usage_date",
    )
    list_filter = ("usage_date",)
    search_fields = (
        "crop_cycle__project__name",
        "input_item__name",
    )
    readonly_fields = ("usage_date",)


@admin.register(CropOutput)
class CropOutputAdmin(admin.ModelAdmin):
    list_display = (
        "crop_cycle",
        "quantity_harvested",
        "quality_grade",
        "date_recorded",
    )
    list_filter = ("quality_grade", "date_recorded")
    search_fields = (
        "crop_cycle__project__name",
        "crop_cycle__crop_type__name",
    )
    readonly_fields = ("date_recorded",)


# ==================================================
# LIVESTOCK
# ==================================================
@admin.register(AnimalType)
class AnimalTypeAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


class LivestockEventInline(admin.TabularInline):
    model = LivestockEvent
    extra = 0
    readonly_fields = ("event_date",)


@admin.register(LivestockBatch)
class LivestockBatchAdmin(admin.ModelAdmin):
    list_display = (
        "animal_type",
        "acquisition_date",
        "quantity",
        "source",
    )
    list_filter = ("animal_type", "acquisition_date")
    search_fields = ("animal_type__name", "source")
    inlines = [LivestockEventInline]


@admin.register(LivestockEvent)
class LivestockEventAdmin(admin.ModelAdmin):
    list_display = (
        "batch",
        "event_type",
        "quantity",
        "event_date",
    )
    list_filter = ("event_type", "event_date")
    search_fields = ("batch__animal_type__name",)
    readonly_fields = ("event_date",)

    def has_delete_permission(self, request, obj=None):
        return False


# ==================================================
# FINANCIALS
# ==================================================
@admin.register(FarmRevenue)
class FarmRevenueAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "sale_date",
        "buyer",
        "amount",
    )
    list_filter = ("sale_date",)
    search_fields = ("project__name", "buyer")
    ordering = ("-sale_date",)


@admin.register(FarmExpense)
class FarmExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "expense_type",
        "amount",
        "expense_date",
    )
    list_filter = ("expense_type", "expense_date")
    search_fields = ("project__name", "expense_type")
    ordering = ("-expense_date",)
