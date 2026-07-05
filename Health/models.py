from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.utils import timezone
from datetime import date

"""
HEALTH APPLICATION MODELS
-------------------------
Comprehensive health management system for Zimbabwe Prisons and Correctional Services.
- Fully normalized database design (3NF)
- No data redundancy - references external identity data
- Station-level data isolation via RBAC
- Comprehensive medical registers for inmates, officers, dependents, community members, and ex-service personnel
- Strict validation and audit trails
"""

# ==================================================
# PATIENT ENTITY (NORMALIZED - NO DATA DUPLICATION)
# ==================================================
class Patient(models.Model):
    PATIENT_TYPE_CHOICES = (
        ("INMATE", "Inmate"),
        ("OFFICER", "Officer"),
        ("DEPENDENT", "Dependent"),
        ("COMMUNITY_MEMBER", "Community Member"),
        ("EX_SERVICE_MEMBER", "Ex-Service Member"),
    )

    patient_type = models.CharField(
        max_length=20,
        choices=PATIENT_TYPE_CHOICES,
        help_text="Type of patient for appropriate data sourcing"
    )

    # Foreign Keys for linked entities (normalized)
    inmate = models.ForeignKey(
        'Reception.Inmate',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='health_records',
        help_text="Reference to inmate record (for inmate patients)"
    )
    officer = models.ForeignKey(
        'HumanResources.Officer',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='health_records',
        help_text="Reference to officer record (for officer patients)"
    )
    dependent = models.ForeignKey(
        'HumanResources.Dependant',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='health_records',
        help_text="Reference to dependent record (for dependent patients)"
    )

    # Stored details for non-linked patients (community/ex-service)
    full_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Full name for community/ex-service patients"
    )
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        help_text="Date of birth for age calculation"
    )
    gender = models.CharField(
        max_length=10,
        choices=[("Male", "Male"), ("Female", "Female")],
        blank=True,
        null=True,
        help_text="Gender for community/ex-service patients"
    )
    address = models.TextField(
        blank=True,
        null=True,
        help_text="Address for chronic patient medication delivery"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        validators=[RegexValidator(r'^\+?[\d\s\-\(\)]+$', "Invalid phone number format")],
        help_text="Contact number for medication follow-up"
    )
    service_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Service number for ex-service members"
    )

    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station for data isolation"
    )
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='patients',
        db_index=True,
        help_text="Organization unit that owns this patient record. Used for data isolation."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "patient"
        ordering = ["-created_at"]

    def clean(self):
        # Validation: Exactly one reference based on patient type
        if self.patient_type == "INMATE":
            if not self.inmate or self.officer or self.dependent or self.full_name:
                raise ValidationError("Inmate patients must have only inmate reference")
        elif self.patient_type == "OFFICER":
            if not self.officer or self.inmate or self.dependent or self.full_name:
                raise ValidationError("Officer patients must have only officer reference")
        elif self.patient_type == "DEPENDENT":
            if not self.dependent or self.inmate or self.officer or self.full_name:
                raise ValidationError("Dependent patients must have only dependent reference")
        elif self.patient_type in ["COMMUNITY_MEMBER", "EX_SERVICE_MEMBER"]:
            if self.inmate or self.officer or self.dependent or not self.full_name:
                raise ValidationError(f"{self.patient_type} patients must have stored details only")
            if self.patient_type == "EX_SERVICE_MEMBER" and not self.service_number:
                raise ValidationError("Ex-service members must have service number")

        # Age validation for stored DOB
        if self.date_of_birth and self.date_of_birth > timezone.now().date():
            raise ValidationError("Date of birth cannot be in the future")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def name(self):
        """Computed full name from linked records or stored data"""
        if self.inmate:
            return f"{self.inmate.surname} {self.inmate.first_name}"
        elif self.officer:
            return f"{self.officer.surname} {self.officer.first_name}"
        elif self.dependent:
            return self.dependent.full_name
        else:
            return self.full_name or "Unknown"

    @property
    def age(self):
        """Computed age from date of birth"""
        dob = None
        if self.inmate:
            dob = self.inmate.date_of_birth
        elif self.officer:
            dob = self.officer.date_of_birth
        elif self.dependent:
            dob = self.dependent.date_of_birth
        else:
            dob = self.date_of_birth

        if dob:
            today = date.today()
            return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return None

    @property
    def identifier(self):
        """Primary identifier (prison/service number or name)"""
        if self.inmate:
            return self.inmate.prison_number
        elif self.officer:
            return self.officer.service_number
        elif self.dependent:
            return f"Dependant of {self.dependent.officer.service_number}"
        else:
            return self.service_number or self.full_name

    def __str__(self):
        return f"{self.patient_type}: {self.identifier}"


# ==================================================
# ADMISSION HEALTH ASSESSMENT REGISTER
# (Mandatory medical screening for all new inmates)
# ==================================================
class AdmissionHealthAssessment(models.Model):
    inmate = models.OneToOneField(
        'Reception.Inmate',
        on_delete=models.CASCADE,
        related_name="admission_health_assessment",
        help_text="Inmate undergoing admission assessment", blank=True, null=True
    )
    assessment_date = models.DateField(
        default=timezone.now,
        help_text="Date of health assessment"
    )

    # Vital measurements
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(20)],
        help_text="Weight in kilograms"
    )
    height = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(100)],
        help_text="Height in centimeters", blank=True, null=True
    )
    bmi = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Body Mass Index (auto-calculated)"
    )

    # Assessment details
    comment = models.TextField(
        help_text="General health assessment comments", blank=True, null=True
    )
    is_chronic_patient = models.BooleanField(
        default=False,
        help_text="Indicates if inmate has chronic conditions requiring ongoing care"
    )

    # Metadata
    assessed_by = models.CharField(
        max_length=100,
        help_text="Healthcare professional conducting assessment"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where assessment was conducted"
    )
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='admission_assessments',
        db_index=True,
        help_text="Organization unit where this assessment was conducted."
    )

    class Meta:
        db_table = "admission_health_assessment"
        ordering = ["-assessment_date"]

    def clean(self):
        # BMI auto-calculation validation
        if self.weight and self.height:
            calculated_bmi = float(self.weight) / ((float(self.height) / 100) ** 2)
            if self.bmi and abs(calculated_bmi - float(self.bmi)) > 0.1:
                raise ValidationError("BMI does not match calculated value from weight and height")

    def save(self, *args, **kwargs):
        # Auto-calculate BMI
        if self.weight and self.height:
            from decimal import Decimal
            calculated_bmi = round(float(self.weight) / ((float(self.height) / 100) ** 2), 2)
            self.bmi = Decimal(str(calculated_bmi))
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Admission Assessment: {self.inmate.prison_number} - {self.assessment_date}"

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=AdmissionHealthAssessment)
def advance_admission_workflow(sender, instance, created, **kwargs):
    """
    When an admission health assessment is created, move the inmate's
    admission status from PENDING_HEALTH_ASSESSMENT to PENDING_ADMIN_APPROVAL.
    """
    if created and instance.inmate:
        if instance.inmate.admission_status == "PENDING_HEALTH_ASSESSMENT":
            instance.inmate.admission_status = "PENDING_ADMIN_APPROVAL"
            instance.inmate.save(update_fields=['admission_status'])


# ==================================================
# DISCHARGE HEALTH ASSESSMENT REGISTER
# (Mandatory medical screening for all discharging inmates)
# ==================================================
class DischargeHealthAssessment(models.Model):
    inmate = models.OneToOneField(
        'Reception.Inmate',
        on_delete=models.CASCADE,
        related_name="discharge_health_assessment",
        help_text="Inmate undergoing discharge assessment"
    )
    assessment_date = models.DateField(
        default=timezone.now,
        help_text="Date of health assessment"
    )

    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(20)],
        help_text="Weight in kilograms"
    )
    health_status = models.CharField(
        max_length=50,
        choices=[
            ("HEALTHY", "Healthy / Fit for Discharge"),
            ("NEEDS_CARE", "Requires ongoing medical care post-discharge"),
            ("CRITICAL", "Critical / Unfit for standard discharge"),
        ],
        default="HEALTHY"
    )
    comment = models.TextField(
        help_text="General health assessment comments", blank=True, null=True
    )

    # Metadata
    assessed_by = models.CharField(
        max_length=100,
        help_text="Healthcare professional conducting assessment"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where assessment was conducted"
    )
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='discharge_assessments',
        db_index=True,
        help_text="Organization unit where this assessment was conducted."
    )

    class Meta:
        db_table = "discharge_health_assessment"
        ordering = ["-assessment_date"]

    def __str__(self):
        return f"Discharge Assessment: {self.inmate.prison_number} - {self.assessment_date}"


# ==================================================
# OUT-PATIENT DEPARTMENT (OPD) REGISTER
# (Medical consultations for all patient types)
# ==================================================
class OutPatientVisit(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="opd_visits",
        help_text="Patient receiving OPD consultation"
    )
    visit_date = models.DateField(
        default=timezone.now,
        help_text="Date of OPD visit"
    )

    # Vital signs
    temperature = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        validators=[MinValueValidator(30), MinValueValidator(45)],
        help_text="Body temperature in Celsius"
    )
    blood_pressure = models.CharField(
        max_length=20,
        help_text="Blood pressure reading (e.g., 120/80)"
    )
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(20)],
        help_text="Current weight in kilograms"
    )

    # Consultation details
    problem = models.TextField(
        help_text="Patient's reported problem/symptoms"
    )
    duration = models.CharField(
        max_length=100,
        help_text="Duration of symptoms (e.g., 3 days, 2 weeks)"
    )
    diagnosis = models.TextField(
        help_text="Medical diagnosis"
    )
    treatment = models.TextField(
        help_text="Prescribed treatment plan"
    )
    referral = models.TextField(
        blank=True,
        null=True,
        help_text="Referral to specialist or other facility if required"
    )

    # Metadata
    attended_by = models.CharField(
        max_length=100,
        help_text="Healthcare professional attending the visit"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where visit occurred"
    )
    follow_up_required = models.BooleanField(
        default=False,
        help_text="Indicates if follow-up visit is needed"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes or observations"
    )

    class Meta:
        db_table = "outpatient_visit"
        ordering = ["-visit_date"]

    def clean(self):
        # BP format validation
        import re
        if not re.match(r'^\d{2,3}/\d{2,3}$', self.blood_pressure):
            raise ValidationError("Blood pressure must be in format systolic/diastolic (e.g., 120/80)")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"OPD Visit: {self.patient.identifier} - {self.visit_date}"


# ==================================================
# MENTAL HEALTH REGISTER
# (Mental health consultations and referrals)
# ==================================================
class MentalHealthVisit(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="mental_health_visits",
        help_text="Patient receiving mental health consultation"
    )
    visit_date = models.DateField(
        default=timezone.now,
        help_text="Date of mental health assessment"
    )

    place_of_reference = models.CharField(
        max_length=200,
        help_text="Location or source of referral"
    )
    reason = models.TextField(
        help_text="Reason for mental health consultation"
    )
    outcome = models.TextField(
        help_text="Outcome of the mental health assessment/treatment"
    )

    # Metadata
    attended_by = models.CharField(
        max_length=100,
        help_text="Mental health professional attending"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where consultation occurred"
    )
    follow_up_required = models.BooleanField(
        default=False,
        help_text="Indicates if follow-up is needed"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional clinical notes"
    )

    class Meta:
        db_table = "mental_health_visit"
        ordering = ["-visit_date"]

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Mental Health: {self.patient.identifier} - {self.visit_date}"


# ==================================================
# CHRONIC PATIENT REGISTER
# (Medication management for chronic conditions)
# ==================================================
class ChronicPatient(models.Model):
    patient = models.OneToOneField(
        Patient,
        on_delete=models.CASCADE,
        related_name="chronic_patient_record",
        help_text="Patient with chronic condition"
    )

    # Medication management
    medication_collection_date = models.DateField(
        help_text="Date when medication was collected"
    )
    medication_types = models.TextField(
        help_text="Types of medication prescribed (comma-separated)"
    )
    quantity_collected = models.TextField(
        help_text="Quantity of each medication collected"
    )

    # Contact for follow-up (stored in Patient model)
    # address and phone_number are in Patient

    # Metadata
    registered_by = models.CharField(
        max_length=100,
        help_text="Healthcare professional registering the patient"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station managing the chronic patient"
    )
    registration_date = models.DateField(
        default=timezone.now,
        help_text="Date of registration in chronic patient program"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes on condition management"
    )

    class Meta:
        db_table = "chronic_patient"
        ordering = ["-registration_date"]

    def clean(self):
        if self.medication_collection_date > timezone.now().date():
            raise ValidationError("Medication collection date cannot be in the future")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Chronic Patient: {self.patient.identifier}"


# ==================================================
# MEDICINE INVENTORY
# ==================================================
class Medicine(models.Model):
    medicine_name = models.CharField(
        max_length=200,
        help_text="Name of the medication"
    )
    dosage_form = models.CharField(
        max_length=50,
        help_text="Form of medication (tablet, syrup, injection, etc.)"
    )
    strength = models.CharField(
        max_length=50,
        help_text="Strength/dosage of medication"
    )
    unit_of_measure = models.CharField(
        max_length=50,
        help_text="Unit of measurement (mg, ml, units, etc.)"
    )
    reorder_level = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Minimum stock level before reorder"
    )

    class Meta:
        db_table = "medicine"
        unique_together = ("medicine_name", "strength", "dosage_form")

    def __str__(self):
        return f"{self.medicine_name} {self.strength}"


# ==================================================
# STOCK CARD REGISTER
# (Inventory tracking for medications)
# ==================================================
class StockCardEntry(models.Model):
    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.PROTECT,
        related_name="stock_entries",
        help_text="Medication being tracked"
    )
    entry_date = models.DateField(
        default=timezone.now,
        help_text="Date of stock transaction"
    )

    # Receipt details
    received_from = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Source of received medication"
    )
    quantity_received = models.PositiveIntegerField(
        default=0,
        help_text="Quantity of medication received"
    )

    # Issue details
    issued_to = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Recipient of issued medication"
    )
    quantity_issued = models.PositiveIntegerField(
        default=0,
        help_text="Quantity of medication issued"
    )

    # Stock calculations
    balance_brought_forward = models.PositiveIntegerField(
        help_text="Stock balance from previous entry"
    )
    adjustment = models.IntegerField(
        default=0,
        help_text="Stock adjustments (positive or negative)"
    )
    losses = models.PositiveIntegerField(
        default=0,
        help_text="Quantity lost or damaged"
    )
    balance = models.PositiveIntegerField(
        help_text="Current stock balance after transaction"
    )

    # Documentation
    issue_voucher = models.FileField(
        upload_to="health/stock_vouchers/",
        blank=True,
        null=True,
        help_text="Uploaded issue voucher for received stock"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Additional notes on the transaction"
    )

    # Metadata
    recorded_by = models.CharField(
        max_length=100,
        help_text="Person recording the entry"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where stock is managed"
    )

    class Meta:
        db_table = "stock_card_entry"
        ordering = ["medicine", "-entry_date"]
        unique_together = ("medicine", "entry_date")

    def clean(self):
        # Ensure only one type of transaction per entry
        transaction_types = [
            bool(self.quantity_received),
            bool(self.quantity_issued),
            bool(self.adjustment),
            bool(self.losses)
        ]
        if sum(transaction_types) != 1:
            raise ValidationError("Each entry must have exactly one type of transaction")

        # Balance validation
        expected_balance = (
            self.balance_brought_forward +
            self.quantity_received -
            self.quantity_issued +
            self.adjustment -
            self.losses
        )
        if expected_balance != self.balance:
            raise ValidationError("Balance does not match calculated value")

        # Voucher required for receipts
        if self.quantity_received > 0 and not self.issue_voucher:
            raise ValidationError("Issue voucher is required for received stock")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Stock Entry: {self.medicine} - {self.entry_date}"


# ==================================================
# MEDICAL EQUIPMENT & TOOLS
# ==================================================
class MedicalEquipment(models.Model):
    equipment_name = models.CharField(
        max_length=100,
        help_text="Name of the medical equipment"
    )
    serial_number = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique serial number of the equipment"
    )
    condition = models.CharField(
        max_length=50,
        choices=[
            ("EXCELLENT", "Excellent"),
            ("GOOD", "Good"),
            ("FAIR", "Fair"),
            ("POOR", "Poor"),
            ("BROKEN", "Broken"),
        ],
        help_text="Current condition of the equipment"
    )
    location = models.CharField(
        max_length=100,
        help_text="Physical location of the equipment"
    )
    station = models.ForeignKey(
        'Auth.Station',
        on_delete=models.PROTECT,
        help_text="Station where equipment is located"
    )

    class Meta:
        db_table = "medical_equipment"

    def __str__(self):
        return f"{self.equipment_name} - {self.serial_number}"


class EquipmentUsageLog(models.Model):
    equipment = models.ForeignKey(
        MedicalEquipment,
        on_delete=models.PROTECT,
        related_name="usage_logs",
        help_text="Equipment being used"
    )
    used_by = models.CharField(
        max_length=100,
        help_text="Person using the equipment"
    )
    usage_date = models.DateTimeField(
        default=timezone.now,
        help_text="Date and time of usage"
    )
    purpose = models.TextField(
        help_text="Purpose of equipment usage"
    )
    returned = models.BooleanField(
        default=False,
        help_text="Whether equipment has been returned"
    )
    return_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date and time of return"
    )

    class Meta:
        db_table = "equipment_usage_log"
        ordering = ["-usage_date"]

    def clean(self):
        if self.returned and not self.return_date:
            raise ValidationError("Return date must be provided if equipment is returned")
        if self.return_date and self.return_date < self.usage_date:
            raise ValidationError("Return date cannot be before usage date")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Usage: {self.equipment.equipment_name} by {self.used_by}"


# ==================================================
# HEALTH AUDIT TRAIL
# ==================================================
class HealthAuditTrail(models.Model):
    action = models.CharField(max_length=200)
    performed_by = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "health_audit_trail"
        ordering = ["-timestamp"]
