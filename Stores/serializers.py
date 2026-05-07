"""
STORES APP SERIALIZERS
=====================
Enterprise-grade DRF serializers for prison stores & inventory.
Validation-heavy, audit-aware, production safe.
"""

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone

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


class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = ["id", "name", "description"]
        read_only_fields = ["id"]



class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "name",
            "category",
            "category_name",
            "unit_of_measure",
            "is_returnable",
            "requires_expiry",
        ]
        read_only_fields = ["id"]


class StockReceiptItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = StockReceiptItem
        fields = [
            "id",
            "item",
            "item_name",
            "quantity",
            "expiry_date",
        ]
        read_only_fields = ["id"]



class StockReceiptSerializer(serializers.ModelSerializer):
    items = StockReceiptItemSerializer(many=True)

    class Meta:
        model = StockReceipt
        fields = [
            "id",
            "reference_number",
            "source",
            "received_by",
            "received_date",
            "remarks",
            "items",
        ]
        read_only_fields = ["id", "received_date"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        with transaction.atomic():
            receipt = StockReceipt.objects.create(**validated_data)

            for item in items_data:
                StockReceiptItem.objects.create(receipt=receipt, **item)

                StockLedger.objects.create(
                    item=item["item"],
                    transaction_type="RECEIVE",
                    quantity=item["quantity"],
                    performed_by=validated_data["received_by"],
                    reference=receipt.reference_number,
                    remarks="Stock received",
                )

        return receipt



class StockLedgerSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    performed_by_name = serializers.CharField(
        source="performed_by.full_name", read_only=True
    )

    class Meta:
        model = StockLedger
        fields = [
            "id",
            "item",
            "item_name",
            "transaction_type",
            "quantity",
            "transaction_date",
            "performed_by",
            "performed_by_name",
            "reference",
            "remarks",
        ]
        read_only_fields = fields  # Ledger must never be edited



class FeedingItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = FeedingItem
        fields = ["id", "item", "item_name", "quantity_used"]



class FeedingSessionSerializer(serializers.ModelSerializer):
    items = FeedingItemSerializer(many=True)

    class Meta:
        model = FeedingSession
        fields = [
            "id",
            "meal_type",
            "feeding_date",
            "inmate_count",
            "recorded_by",
            "items",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        with transaction.atomic():
            session = FeedingSession.objects.create(**validated_data)

            for item in items_data:
                FeedingItem.objects.create(feeding_session=session, **item)

                StockLedger.objects.create(
                    item=item["item"],
                    transaction_type="ISSUE",
                    quantity=item["quantity_used"],
                    performed_by=validated_data["recorded_by"],
                    reference=f"FEED-{session.id}",
                    remarks=f"{session.meal_type} feeding",
                )

        return session


class OfficerIssueSerializer(serializers.ModelSerializer):
    officer_name = serializers.CharField(source="officer.full_name", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = OfficerIssue
        fields = [
            "id",
            "item",
            "item_name",
            "officer",
            "officer_name",
            "quantity",
            "issue_date",
            "issued_by",
            "remarks",
        ]
        read_only_fields = ["id", "issue_date"]

    def create(self, validated_data):
        with transaction.atomic():
            issue = OfficerIssue.objects.create(**validated_data)

            StockLedger.objects.create(
                item=issue.item,
                transaction_type="ISSUE",
                quantity=issue.quantity,
                performed_by=issue.issued_by,
                reference=f"OFFICER-{issue.officer_id}",
                remarks="Issued to officer",
            )

        return issue


class StockWriteOffSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockWriteOff
        fields = [
            "id",
            "item",
            "quantity",
            "reason",
            "approved_by",
            "writeoff_date",
        ]
        read_only_fields = ["id", "writeoff_date"]

    def create(self, validated_data):
        with transaction.atomic():
            writeoff = StockWriteOff.objects.create(**validated_data)

            StockLedger.objects.create(
                item=writeoff.item,
                transaction_type="WRITE_OFF",
                quantity=writeoff.quantity,
                performed_by=writeoff.approved_by,
                reference=f"WRITEOFF-{writeoff.id}",
                remarks=writeoff.reason,
            )

        return writeoff

class StoreAuditTrailSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(
        source="performed_by.full_name", read_only=True
    )

    class Meta:
        model = StoreAuditTrail
        fields = "__all__"
        read_only_fields = fields



