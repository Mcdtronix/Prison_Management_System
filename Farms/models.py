"""
FARMS APPLICATION MODELS
-----------------------
Prison agricultural production management.
Fully normalized (3NF), project-based, audit-ready.
"""

from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

# =============================
# FARM PROJECTS
# =============================

class FarmProject(models.Model):
    name = models.CharField(max_length=150)
    start_date = models.DateField()
    expected_end_date = models.DateField(null=True, blank=True)
    supervising_officer = models.ForeignKey('HumanResources.Officer', on_delete=models.PROTECT)
    status = models.CharField(max_length=50)

    class Meta:
        db_table = "farm_project"

    def clean(self):
        if self.expected_end_date and self.expected_end_date < self.start_date:
            raise ValidationError("Project end date cannot be before start date")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# =============================
# CROP PRODUCTION
# =============================

class CropType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "crop_type"


class CropCycle(models.Model):
    project = models.ForeignKey(FarmProject, on_delete=models.PROTECT)
    crop_type = models.ForeignKey(CropType, on_delete=models.PROTECT)
    planting_date = models.DateField()
    expected_harvest_date = models.DateField()
    actual_harvest_date = models.DateField(null=True, blank=True)
    area_planted_hectares = models.DecimalField(max_digits=6, decimal_places=2)

    class Meta:
        db_table = "crop_cycle"

    def clean(self):
        if self.expected_harvest_date < self.planting_date:
            raise ValidationError("Expected harvest date cannot be before planting date")
        if self.actual_harvest_date and self.actual_harvest_date < self.planting_date:
            raise ValidationError("Actual harvest date cannot be before planting date")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CropInputUsage(models.Model):
    crop_cycle = models.ForeignKey(CropCycle, on_delete=models.CASCADE)
    input_item = models.ForeignKey('Stores.InventoryItem', on_delete=models.PROTECT)
    quantity_used = models.PositiveIntegerField()
    usage_date = models.DateField(default=timezone.now)

    class Meta:
        db_table = "crop_input_usage"


class CropOutput(models.Model):
    crop_cycle = models.ForeignKey(CropCycle, on_delete=models.CASCADE)
    quantity_harvested = models.PositiveIntegerField()
    quality_grade = models.CharField(max_length=50)
    date_recorded = models.DateField(default=timezone.now)

    class Meta:
        db_table = "crop_output"


# =============================
# LIVESTOCK MANAGEMENT
# =============================

class AnimalType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "animal_type"


class LivestockBatch(models.Model):
    animal_type = models.ForeignKey(AnimalType, on_delete=models.PROTECT)
    acquisition_date = models.DateField()
    quantity = models.PositiveIntegerField()
    source = models.CharField(max_length=100)

    class Meta:
        db_table = "livestock_batch"


class LivestockEvent(models.Model):
    EVENT_TYPES = (
        ("BIRTH", "Birth"),
        ("DEATH", "Death"),
        ("SALE", "Sale"),
        ("SLAUGHTER", "Slaughter"),
    )

    batch = models.ForeignKey(LivestockBatch, on_delete=models.PROTECT)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    quantity = models.PositiveIntegerField()
    event_date = models.DateField(default=timezone.now)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "livestock_event"

    def clean(self):
        if self.quantity > self.batch.quantity:
            raise ValidationError("Event quantity exceeds available livestock")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# =============================
# FINANCIAL TRACKING
# =============================

class FarmRevenue(models.Model):
    project = models.ForeignKey(FarmProject, on_delete=models.PROTECT)
    sale_date = models.DateField()
    buyer = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "farm_revenue"


class FarmExpense(models.Model):
    project = models.ForeignKey(FarmProject, on_delete=models.PROTECT)
    expense_type = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()

    class Meta:
        db_table = "farm_expense"