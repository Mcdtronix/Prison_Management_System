from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin, StationScopedMixin, by_officer, by_units

from rest_framework.permissions import IsAuthenticated
from Auth.permissions import StoresRecords, ReadOnlyOr

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
    StoreAuditTrail
)
from .serializers import (
    ItemCategorySerializer,
    InventoryItemSerializer,
    StockReceiptSerializer,
    StockReceiptItemSerializer,
    StockLedgerSerializer,
    FeedingSessionSerializer,
    FeedingItemSerializer,
    OfficerIssueSerializer,
    StockWriteOffSerializer,
    StoreAuditTrailSerializer
)


class ItemCategoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    permission_classes = [IsAuthenticated, ReadOnlyOr.of('stores.access')]



class InventoryItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related("category")
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated, StoresRecords]



class StockReceiptViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceipt.objects.prefetch_related("items")
    serializer_class = StockReceiptSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
    scope_rule = by_units('receiving_org_unit')



class StockReceiptItemViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceiptItem.objects.select_related("item")
    serializer_class = StockReceiptItemSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
    scope_rule = by_units('receipt__receiving_org_unit')


class StockLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockLedger.objects.select_related("item", "performed_by")
    serializer_class = StockLedgerSerializer
    permission_classes = [IsAuthenticated, StoresRecords]



class FeedingSessionViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingSession.objects.prefetch_related("items")
    serializer_class = FeedingSessionSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
    scope_rule = by_units('providing_org_unit', 'consuming_org_unit')



class FeedingItemViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingItem.objects.all()
    serializer_class = FeedingItemSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
    scope_rule = by_units('feeding_session__providing_org_unit', 'feeding_session__consuming_org_unit')

class OfficerIssueViewSet(StationScopedMixin, OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerIssue.objects.select_related("item", "officer", "issued_by")
    serializer_class = OfficerIssueSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
    scope_rule = by_officer('officer')



class StockWriteOffViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockWriteOff.objects.select_related("item", "approved_by")
    serializer_class = StockWriteOffSerializer
    permission_classes = [IsAuthenticated, StoresRecords]

class StoreAuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StoreAuditTrail.objects.select_related("performed_by")
    serializer_class = StoreAuditTrailSerializer
    permission_classes = [IsAuthenticated, StoresRecords]
