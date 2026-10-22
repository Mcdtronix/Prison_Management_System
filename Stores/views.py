from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.exceptions import PermissionDenied, ValidationError
from Core.mixins import OrgUnitContextMixin
from Auth.permissions import IsStoresOfficer, IsStationDataOwner
from Auth.utils import get_user_operational_context

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


class IsStoresOfficerOrReadOnly(BasePermission):
    """
    Allow read-only catalog access for authenticated staff.
    Mutations require Stores Officer role.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return IsStoresOfficer().has_permission(request, view)


def get_stores_scoped_units(request):
    """Return visible org units for Stores filtering."""
    if request.user.is_superuser:
        return None
    org_unit, _ = get_user_operational_context(request)
    if org_unit and org_unit.unit_type == 'NATIONAL_HQ':
        return None
    visible_units = getattr(request, 'visible_org_units', None)
    if visible_units is not None:
        return visible_units
    if org_unit:
        from Auth.models import OrgUnit
        return OrgUnit.objects.filter(id=org_unit.id)
    return None


class ItemCategoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    permission_classes = [IsAuthenticated, IsStoresOfficerOrReadOnly]


class InventoryItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related("category")
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficerOrReadOnly]


class StockReceiptViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceipt.objects.all()
    serializer_class = StockReceiptSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = StockReceipt.objects.prefetch_related("items").select_related("received_by", "receiving_org_unit")
        if units is not None:
            return qs.filter(receiving_org_unit__in=units)
        return qs

    def perform_create(self, serializer):
        org_unit, _ = get_user_operational_context(self.request)
        if not org_unit and not self.request.user.is_superuser:
            raise PermissionDenied("You must have an operational organization unit to receive stock.")

        # Ensure server-side validation of ownership
        target_unit = serializer.validated_data.get('receiving_org_unit') or org_unit
        units = get_stores_scoped_units(self.request)
        if units is not None and target_unit not in units:
            raise PermissionDenied("Cannot assign stock receipt to an unauthorized organization unit.")

        serializer.save(receiving_org_unit=target_unit)

    def perform_update(self, serializer):
        target_unit = serializer.validated_data.get('receiving_org_unit')
        if target_unit:
            units = get_stores_scoped_units(self.request)
            if units is not None and target_unit not in units:
                raise PermissionDenied("Cannot reassign stock receipt to an unauthorized organization unit.")
        serializer.save()


class StockReceiptItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockReceiptItem.objects.all()
    serializer_class = StockReceiptItemSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = StockReceiptItem.objects.select_related("item", "receipt")
        if units is not None:
            return qs.filter(receipt__receiving_org_unit__in=units)
        return qs


class StockLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """Append-only ledger of stock transactions."""
    queryset = StockLedger.objects.all()
    serializer_class = StockLedgerSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = StockLedger.objects.select_related("item", "performed_by")
        # If receipt reference exists, scope by receiving org unit
        return qs


class FeedingSessionViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingSession.objects.all()
    serializer_class = FeedingSessionSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = FeedingSession.objects.prefetch_related("items").select_related("providing_org_unit", "consuming_org_unit")
        if units is not None:
            return qs.filter(providing_org_unit__in=units)
        return qs

    def perform_create(self, serializer):
        org_unit, _ = get_user_operational_context(self.request)
        if not org_unit and not self.request.user.is_superuser:
            raise PermissionDenied("Operational organization unit required for feeding session.")

        target_providing = serializer.validated_data.get('providing_org_unit') or org_unit
        units = get_stores_scoped_units(self.request)
        if units is not None and target_providing not in units:
            raise PermissionDenied("Cannot record feeding from an unauthorized organization unit.")

        serializer.save(providing_org_unit=target_providing)


class FeedingItemViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = FeedingItem.objects.all()
    serializer_class = FeedingItemSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = FeedingItem.objects.select_related("session", "item")
        if units is not None:
            return qs.filter(session__providing_org_unit__in=units)
        return qs


class OfficerIssueViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = OfficerIssue.objects.all()
    serializer_class = OfficerIssueSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = OfficerIssue.objects.select_related("item", "officer", "issued_by")
        # Scoped via officer current posting or issued_by station
        return qs


class StockWriteOffViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = StockWriteOff.objects.all()
    serializer_class = StockWriteOffSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer, IsStationDataOwner]

    def get_queryset(self):
        units = get_stores_scoped_units(self.request)
        qs = StockWriteOff.objects.select_related("item", "approved_by")
        return qs


class StoreAuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StoreAuditTrail.objects.select_related("performed_by")
    serializer_class = StoreAuditTrailSerializer
    permission_classes = [IsAuthenticated, IsStoresOfficer]
