from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated

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
    permission_classes = [IsAuthenticated]



class InventoryItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related("category")
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]



class StockReceiptViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceipt.objects.prefetch_related("items")
    serializer_class = StockReceiptSerializer
    permission_classes = [IsAuthenticated]



class StockReceiptItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceiptItem.objects.select_related("item")
    serializer_class = StockReceiptItemSerializer
    permission_classes = [IsAuthenticated]


class StockLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockLedger.objects.select_related("item", "performed_by")
    serializer_class = StockLedgerSerializer
    permission_classes = [IsAuthenticated]



class FeedingSessionViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingSession.objects.prefetch_related("items")
    serializer_class = FeedingSessionSerializer
    permission_classes = [IsAuthenticated]



class FeedingItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingItem.objects.all()
    serializer_class = FeedingItemSerializer
    permission_classes = [IsAuthenticated]

class OfficerIssueViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerIssue.objects.select_related("item", "officer", "issued_by")
    serializer_class = OfficerIssueSerializer
    permission_classes = [IsAuthenticated]



class StockWriteOffViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockWriteOff.objects.select_related("item", "approved_by")
    serializer_class = StockWriteOffSerializer
    permission_classes = [IsAuthenticated]

class StoreAuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StoreAuditTrail.objects.select_related("performed_by")
    serializer_class = StoreAuditTrailSerializer
    permission_classes = [IsAuthenticated]
