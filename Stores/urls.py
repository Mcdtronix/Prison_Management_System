"""
STORES APP URL CONFIGURATION
============================
RESTful routing for inventory, rations, issues, ledger, and audit.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ItemCategoryViewSet,
    InventoryItemViewSet,
    StockReceiptViewSet,
    StockLedgerViewSet,
    FeedingSessionViewSet,
    OfficerIssueViewSet,
    StockWriteOffViewSet,
    StoreAuditTrailViewSet,
)

router = DefaultRouter()
router.register(r"item-categories", ItemCategoryViewSet, basename="item-category")
router.register(r"inventory-items", InventoryItemViewSet, basename="inventory-item")
router.register(r"stock-receipts", StockReceiptViewSet, basename="stock-receipt")
router.register(r"stock-ledger", StockLedgerViewSet, basename="stock-ledger")
router.register(r"feeding-sessions", FeedingSessionViewSet, basename="feeding-session")
router.register(r"officer-issues", OfficerIssueViewSet, basename="officer-issue")
router.register(r"stock-writeoffs", StockWriteOffViewSet, basename="stock-writeoff")
router.register(r"audit-trail", StoreAuditTrailViewSet, basename="store-audit")

urlpatterns = [
    path("", include(router.urls)),
]
