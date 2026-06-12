"""
STORES APPLICATION MODELS
------------------------
Enterprise-grade prison stores and inventory management.
Ledger-based, audit-ready, mathematically consistent.
"""

from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone


# =============================
# MASTER DATA (CATEGORIES & ITEMS)
# =============================

class ItemCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_ration_category = models.BooleanField(default=False)

    class Meta:
        db_table = "store_item_category"

    def __str__(self):
        return self.name

class InventoryItem(models.Model):
    name = models.CharField(max_length=150)
    category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT)
    unit_of_measure = models.CharField(max_length=50)
    is_returnable = models.BooleanField(default=False)
    requires_expiry = models.BooleanField(default=False)

    class Meta:
        db_table = "inventory_item"
        unique_together = ("name", "unit_of_measure")

    def clean(self):
        if self.is_returnable and self.requires_expiry:
            raise ValidationError("Returnable items cannot require expiry tracking")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    
    def __str__(self):
        return f"{self.name} ({self.unit_of_measure})"


# =============================
# STOCK RECEIPTS (FROM HQ / SUPPLIERS)
# =============================
class StockReceipt(models.Model):
    SOURCE_CHOICES = (
        ("PROVINCIAL_HQ", "Provincial HQ"),
        ("NATIONAL_HQ", "National HQ"),
        ("SUPPLIER", "External Supplier"),
        ("TRANSFER", "Inter-Station Transfer"),
    )

    reference_number = models.CharField(max_length=100, unique=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    received_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT
    )
    received_date = models.DateField(default=timezone.now)
    remarks = models.TextField(blank=True)
    receiving_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='stock_receipts',
        db_index=True,
        help_text="Organization unit that receives this stock. Used for data isolation."
    )

    class Meta:
        db_table = "stock_receipt"

    def __str__(self):
        return f"Receipt {self.reference_number} | {self.source} | {self.received_date}"



class StockReceiptItem(models.Model):
    receipt = models.ForeignKey(StockReceipt, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "stock_receipt_item"

    def clean(self):
        if self.item.requires_expiry and not self.expiry_date:
            raise ValidationError("Expiry date is required for this item")

    def __str__(self):
        return f"{self.item.name} - {self.quantity} {self.item.unit_of_measure}"


# =============================
# STOCK LEDGER (THE HEART OF ACCOUNTABILITY)
# =============================

class StockLedger(models.Model):
    TRANSACTION_TYPES = (
        ("RECEIVE", "Receive"),
        ("ISSUE", "Issue"),
        ("RETURN", "Return"),
        ("WRITE_OFF", "Write Off"),
        ("LOSS", "Loss"),
        ("DAMAGE", "Damage"),
    )

    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    transaction_type = models.CharField(max_length=15, choices=TRANSACTION_TYPES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_date = models.DateTimeField(default=timezone.now)
    performed_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT
    )
    reference = models.CharField(max_length=100)
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = "stock_ledger"
        ordering = ["transaction_date"]

    def clean(self):
        if self.quantity <= 0:
            raise ValidationError("Transaction quantity must be positive")

    def __str__(self):
        return (
            f"{self.transaction_type} | "
            f"{self.item.name} | "
            f"{self.quantity} {self.item.unit_of_measure} | "
            f"{self.transaction_date.date()}"
        )


# =============================
# INMATE FEEDING & RATIONS ISSUANCE
# =============================

class FeedingSession(models.Model):
    MEAL_CHOICES = (
        ("BREAKFAST", "Breakfast"),
        ("LUNCH", "Lunch"),
        ("SUPPER", "Supper"),
    )

    meal_type = models.CharField(max_length=10, choices=MEAL_CHOICES)
    feeding_date = models.DateField(default=timezone.now)
    inmate_count = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    recorded_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT
    )
    providing_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='feeding_sessions_provided',
        help_text="Organization unit providing the food/rations."
    )
    consuming_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='feeding_sessions_consumed',
        help_text="Organization unit consuming the food/rations."
    )

    class Meta:
        db_table = "feeding_session"
        unique_together = ("meal_type", "feeding_date")

    def __str__(self):
        return f"{self.meal_type} | {self.feeding_date} | {self.inmate_count} inmates"


class FeedingItem(models.Model):
    feeding_session = models.ForeignKey(FeedingSession, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    quantity_used = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "feeding_item"

    def clean(self):
        if not self.item.category.is_ration_category:
            raise ValidationError("Only ration items can be used for inmate feeding")


    def __str__(self):
        return (
            f"{self.item.name} - "
            f"{self.quantity_used} {self.item.unit_of_measure}"
        )



# =============================
# OFFICER & ASSET ISSUANCE
# =============================
class OfficerIssue(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    officer = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT,
        related_name="issued_items"
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    issue_date = models.DateField(default=timezone.now)
    issued_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT,
        related_name="authorised_issues"
    )
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = "officer_issue"

    def __str__(self):
        return (
            f"{self.item.name} → "
            f"{self.officer} | "
            f"{self.quantity} {self.item.unit_of_measure}"
        )



# =============================
# WRITE-OFFS & LOSSES (MANDATORY AUDIT JUSTIFICATION)
# =============================
class StockWriteOff(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT,
        related_name="approved_writeoffs"
    )
    writeoff_date = models.DateField(default=timezone.now)

    class Meta:
        db_table = "stock_write_off"

    def __str__(self):
        return (
            f"Write-off | {self.item.name} | "
            f"{self.quantity} {self.item.unit_of_measure} | "
            f"{self.writeoff_date}"
        )



# =============================
# AUDIT TRAIL (WHO DID WHAT)
# =============================
class StoreAuditTrail(models.Model):
    action = models.CharField(max_length=100)
    performed_by = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    description = models.TextField()

    class Meta:
        db_table = "store_audit_trail"


    def __str__(self):
        return f"{self.action} | {self.performed_by} | {self.timestamp}"



# =============================
# =============================
# =============================
# =============================
# ==========================
# =============================
# STOCK & BATCHES
# =============================

# class StockBatch(models.Model):
#     item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
#     batch_number = models.CharField(max_length=50)
#     quantity_available = models.PositiveIntegerField()
#     expiry_date = models.DateField(null=True, blank=True)
#     source = models.CharField(max_length=100)
#     date_received = models.DateField(default=timezone.now)

#     class Meta:
#         db_table = "stock_batch"
#         unique_together = ("item", "batch_number")

#     def clean(self):
#         if self.item.expiry_required and not self.expiry_date:
#             raise ValidationError("Expiry date is required for this item")
#         if self.expiry_date and self.expiry_date <= timezone.now().date():
#             raise ValidationError("Expired stock cannot be recorded")

#     def save(self, *args, **kwargs):
#         self.full_clean()
#         super().save(*args, **kwargs)


# # =============================
# # STOCK TRANSACTIONS (LEDGER)
# # =============================

# class StockTransaction(models.Model):
#     TRANSACTION_TYPES = (
#         ("RECEIVE", "Receive"),
#         ("ISSUE", "Issue"),
#         ("RETURN", "Return"),
#         ("LOSS", "Loss"),
#         ("DAMAGE", "Damage"),
#         ("WRITE_OFF", "Write-off"),
#     )

#     batch = models.ForeignKey(StockBatch, on_delete=models.PROTECT)
#     transaction_type = models.CharField(max_length=15, choices=TRANSACTION_TYPES)
#     quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
#     performed_by = models.ForeignKey('HumanResources.Officer', on_delete=models.PROTECT)
#     transaction_date = models.DateTimeField(default=timezone.now)
#     remarks = models.TextField(blank=True, null=True)

#     class Meta:
#         db_table = "stock_transaction"

#     def clean(self):
#         if self.transaction_type in ["ISSUE", "LOSS", "DAMAGE", "WRITE_OFF"]:
#             if self.quantity > self.batch.quantity_available:
#                 raise ValidationError("Insufficient stock for this transaction")

#     def save(self, *args, **kwargs):
#         self.full_clean()
#         with transaction.atomic():
#             if self.pk is None:
#                 if self.transaction_type == "RECEIVE":
#                     self.batch.quantity_available += self.quantity
#                 else:
#                     self.batch.quantity_available -= self.quantity
#                 self.batch.save()
#             super().save(*args, **kwargs)


# # =============================
# # ISSUES & RETURNS
# # =============================

# class ItemIssue(models.Model):
#     transaction = models.OneToOneField(StockTransaction, on_delete=models.CASCADE)
#     issued_to_inmate = models.ForeignKey('Reception.Inmate', null=True, blank=True, on_delete=models.PROTECT)
#     issued_to_officer = models.ForeignKey('HumanResources.Officer', null=True, blank=True, on_delete=models.PROTECT, related_name='store_issues')
#     issue_purpose = models.TextField()
#     expected_return_date = models.DateField(null=True, blank=True)

#     class Meta:
#         db_table = "item_issue"

#     def clean(self):
#         if bool(self.issued_to_inmate) == bool(self.issued_to_officer):
#             raise ValidationError("Item must be issued to either an inmate or an officer")
#         if self.transaction.batch.item.is_returnable and not self.expected_return_date:
#             raise ValidationError("Expected return date required for returnable items")

#     def save(self, *args, **kwargs):
#         self.full_clean()
#         super().save(*args, **kwargs)


# class ItemReturn(models.Model):
#     issue = models.OneToOneField(ItemIssue, on_delete=models.CASCADE)
#     return_date = models.DateField(default=timezone.now)
#     condition_on_return = models.CharField(max_length=100)
#     received_by = models.ForeignKey('HumanResources.Officer', on_delete=models.PROTECT)

#     class Meta:
#         db_table = "item_return"

#     def clean(self):
#         if self.return_date < self.issue.transaction.transaction_date.date():
#             raise ValidationError("Return date cannot be before issue date")

#     def save(self, *args, **kwargs):
#         self.full_clean()
#         super().save(*args, **kwargs)