"""
STORES APP ADMIN CONFIGURATION
==============================
Professional, audit-safe Django Admin for prison stores.
"""

from django.contrib import admin
from .models import (
    ItemCategory,
    InventoryItem,
    StockReceipt,
    StockReceiptItem,
    StockLedger,
    FeedingSession,
    FeedingItem,
    OfficerIssue,
    StockWriteOff,
    StoreAuditTrail,
)


# ==================================================
# MASTER DATA
# ==================================================
@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)



@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "unit_of_measure",
        "is_returnable",
        "requires_expiry",
    )
    list_filter = ("category", "is_returnable", "requires_expiry")
    search_fields = ("name",)



class StockReceiptItemInline(admin.TabularInline):
    model = StockReceiptItem
    extra = 0

@admin.register(StockReceipt)
class StockReceiptAdmin(admin.ModelAdmin):
    list_display = (
        "reference_number",
        "source",
        "received_by",
        "received_date",
    )
    list_filter = ("source", "received_date")
    search_fields = ("reference_number", "received_by__service_number")
    readonly_fields = ("received_date",)
    inlines = [StockReceiptItemInline]



# ==================================================
# STOCK & LEDGER
# ==================================================
@admin.register(StockLedger)
class StockLedgerAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "transaction_type",
        "quantity",
        "performed_by",
        "transaction_date",
        "reference",
    )
    list_filter = ("transaction_type", "transaction_date")
    search_fields = ("item__name", "reference", "performed_by__service_number")
    readonly_fields = [field.name for field in StockLedger._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False



class FeedingItemInline(admin.TabularInline):
    model = FeedingItem
    extra = 0

@admin.register(FeedingSession)
class FeedingSessionAdmin(admin.ModelAdmin):
    list_display = (
        "feeding_date",
        "meal_type",
        "inmate_count",
        "recorded_by",
    )
    list_filter = ("meal_type", "feeding_date")
    search_fields = ("recorded_by__service_number",)
    inlines = [FeedingItemInline]



# ==================================================
# ISSUES & RETURNS
# ==================================================
@admin.register(OfficerIssue)
class OfficerIssueAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "officer",
        "quantity",
        "issue_date",
        "issued_by",
    )
    list_filter = ("issue_date",)
    search_fields = (
        "officer__service_number",
        "item__name",
    )
    readonly_fields = ("issue_date",)



@admin.register(StockWriteOff)
class StockWriteOffAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "quantity",
        "approved_by",
        "writeoff_date",
    )
    list_filter = ("writeoff_date",)
    search_fields = ("item__name", "approved_by__service_number")
    readonly_fields = ("writeoff_date",)


@admin.register(StoreAuditTrail)
class StoreAuditTrailAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "performed_by",
        "timestamp",
    )
    list_filter = ("timestamp",)
    search_fields = ("action", "performed_by__service_number")
    readonly_fields = [field.name for field in StoreAuditTrail._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
