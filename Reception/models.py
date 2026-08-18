from django.db import models
from django.core.validators import RegexValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


# -----------------------------
# CORE INMATE ENTITY
# -----------------------------
class Inmate(models.Model):
    admission_type = models.CharField(
        max_length=20,
        choices=[("NEW_ADMISSION", "New Admission"), ("TRANSFER", "Transfer")], default="New Admission",
    )
    prison_number = models.CharField(
        max_length=10,
        unique=True,
        validators=[
            RegexValidator(
                r"^\d{4}/\d{2}$",
                "Prison number must be in the format 0001/25"
            )
        ]
    )
    crb_number = models.CharField(max_length=30, blank=True, null=True)
    first_name = models.CharField(max_length=100)
    surname = models.CharField(max_length=100)
    other_names = models.CharField(max_length=100, blank=True, null=True)
    national_id = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        validators=[RegexValidator(r"^[0-9]{2}-[0-9]{6,7}\s?[A-Z]\s?[0-9]{2}$", "Invalid National ID format")]
    )
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=[("Male", "Male"), ("Female", "Female")])
    marital_status = models.CharField(max_length=20, choices=[("Single", "Single"), ("Married", "Married"), ("Divorced", "Divorced"), ("Widowed", "Widowed")], blank=True, null=True)
    nationality = models.CharField(max_length=50)
    address = models.TextField(blank=True, null=True)
    educational_level = models.CharField(max_length=100, blank=True, null=True)
    race = models.CharField(max_length=50, blank=True, null=True)
    headman = models.CharField(max_length=100, blank=True, null=True)
    chief = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    occupation = models.CharField(max_length=100, blank=True, null=True)
    is_first_time_offender = models.BooleanField(default=True)
    inmate_image = models.ImageField(upload_to="inmate/photos/", blank=True, null=True)
    admission_date = models.DateField(default=timezone.now)
    ADMISSION_STATUS_CHOICES = [
        ("PENDING_HEALTH_ASSESSMENT", "Pending Health Assessment"),
        ("PENDING_ADMIN_APPROVAL", "Pending Admin Approval"),
        ("ADMISSION_CONFIRMED", "Admission Confirmed"),
    ]
    admission_status = models.CharField(
        max_length=30,
        choices=ADMISSION_STATUS_CHOICES,
        default="PENDING_HEALTH_ASSESSMENT"
    )
    current_status = models.CharField(
        max_length=20,
        choices=[
            ("IN_CUSTODY", "In Custody"),
            ("TRANSFERRED", "Transferred"),
            ("ESCAPED", "Escaped"),
            ("DISCHARGED", "Discharged"),
            ("DECEASED", "Deceased"),
        ],
        default="IN_CUSTODY",
    )
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='inmates',
        db_index=True,
        help_text="Organization unit that owns/admits this inmate. Used for data isolation."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inmate"
        ordering = ["-admission_date"]

    def save(self, *args, **kwargs):
        if not self.prison_number:
            year_suffix = timezone.now().strftime("%y")
            prison_numbers = Inmate.objects.filter(prison_number__endswith=f"/{year_suffix}").values_list('prison_number', flat=True)
            max_num = 0
            for pn in prison_numbers:
                if pn:
                    try:
                        num = int(pn.split('/')[0])
                        if num > max_num:
                            max_num = num
                    except (ValueError, IndexError):
                        pass
            self.prison_number = f"{(max_num + 1):04d}/{year_suffix}"
        super().save(*args, **kwargs)

    def clean(self):
        if self.date_of_birth >= self.admission_date:
            raise ValidationError("Admission date must be after date of birth")
        

    def __str__(self):
        return f"{self.prison_number} - {self.surname} {self.first_name}"

    def get_computed_classification(self):
        """
        Compute the expected classification based on unconvicted offences and remaining sentence term.
        - Unconvicted or >= 84 months (7 yrs) remaining -> D
        - 36 to < 84 months remaining -> C
        - 18 to < 36 months remaining -> B
        - < 18 months remaining -> A
        """
        from django.utils import timezone
        
        # Check for unconvicted offences
        if self.offences.filter(Offence_status="UNCONVICTED").exists():
            return "D"
            
        # Calculate total net sentence
        total_net_sentence_days = 0
        for conviction in self.convictions.all():
            total_net_sentence_days += (conviction.effective_sentence_days - conviction.remission_days)
            
        # Calculate days served
        today = timezone.now().date()
        days_served = (today - self.admission_date).days
        if days_served < 0:
            days_served = 0
            
        remaining_days = max(0, total_net_sentence_days - days_served)
        remaining_months = remaining_days / 30.44
        
        if remaining_months >= 84:
            return "D"
        elif remaining_months >= 36:
            return "C"
        elif remaining_months >= 18:
            return "B"
        else:
            return "A"


# -----------------------------
# NEXT OF KIN (HISTORICAL)
# -----------------------------
class NextOfKin(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="next_of_kin")
    full_name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=50)
    address = models.TextField()
    contact = models.CharField(max_length=20)

    class Meta:
        db_table = "next_of_kin"


# -----------------------------
# STATION HISTORY
# -----------------------------
# Note: Station model is now in Auth app (Auth.Station)
# This ensures consistency across the system

class InmateStationHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="station_history")
    station = models.ForeignKey('Auth.Station', on_delete=models.PROTECT)
    date_admitted = models.DateField()
    date_released = models.DateField(blank=True, null=True)
    reason = models.CharField(max_length=50)

    class Meta:
        db_table = "inmate_station_history"
        ordering = ["-date_admitted"]

    def clean(self):
        if self.date_released and self.date_released < self.date_admitted:
            raise ValidationError("Release date cannot be earlier than admission date")


# -----------------------------
# CLASSIFICATION HISTORY
# -----------------------------
class InmateClassificationHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="classification_history")
    classification = models.CharField(max_length=20, choices=[("A", "A"), ("B", "B"), ("C", "C"), ("D", "D"), ("COND", "Condemned"), ("PUSOD", "PUSOD")])
    effective_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)
    APPROVAL_STATUS_CHOICES = [
        ("PENDING", "Pending Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default="PENDING"
    )

    class Meta:
        db_table = "inmate_classification_history"
        ordering = ["-effective_date"]

    def clean(self):
        if self.effective_date < self.inmate.admission_date:
            raise ValidationError("Classification date cannot precede inmate admission date")


# -----------------------------
# OFFENCE & COURT HISTORY
# -----------------------------
class Offence(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="offences")
    offence_description = models.TextField()
    court = models.CharField(max_length=100)
    date_charged = models.DateField()
    Offence_status = models.CharField(max_length=20, choices=[("UNCONVICTED", "Unconvicted"), ("CONVICTED", "Convicted"), ("DISCHARGED", "Discharged")], default="UNCONVICTED")
    
    has_bail = models.BooleanField(default=False)
    bail_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "offence"

    def __str__(self):
        return f"{self.offence_description[:50]}..."

class CourtSession(models.Model):
    """
    Tracks the history of court appearances and postponements.
    Linked to Offence so it persists even if the inmate is later convicted.
    """
    offence = models.ForeignKey(Offence, on_delete=models.CASCADE, related_name="court_sessions")
    session_date = models.DateField(help_text="Date when the court session took place")
    
    OUTCOME_CHOICES = [
        ("SCHEDULED", "Scheduled / Pending"),
        ("REMANDED", "Remanded (Next Court Date Set)"),
        ("CONVICTED", "Convicted / Sentenced"),
        ("DISCHARGED", "Discharged"),
        ("RESTITUTION_SETTLED", "Restitution Settled (Closed)")
    ]
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default="SCHEDULED", help_text="Outcome of the session")
    next_court_date = models.DateField(null=True, blank=True, help_text="The new court date set during this session (required if remanded or scheduled)")
    remarks = models.TextField(blank=True, null=True)
    warrant_document = models.FileField(upload_to="court_warrants/", blank=True, null=True, help_text="Document/Warrant requesting the inmate to attend court")

    class Meta:
        db_table = "court_session"
        ordering = ["-session_date"]

    def clean(self):
        if self.outcome in ["REMANDED", "SCHEDULED"] and not self.next_court_date:
            raise ValidationError(f"Next court date is required when {self.outcome.lower()}.")
        if self.next_court_date and self.next_court_date <= self.session_date:
            raise ValidationError("Next court date must be after the session date.")

class Restitution(models.Model):
    offence = models.ForeignKey(Offence, on_delete=models.CASCADE, related_name="restitutions")
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="restitution", blank=True, null=True)
    restitution_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    restitution_date = models.DateField()
    alternative_restitution_sentence = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('partial', 'Partial'), ('paid', 'Paid'), ('waived', 'Waived')],
        default='pending'
    )
    receipt = models.FileField(upload_to='inmate/restitution_receipts/', blank=True, null=True)

    restitution_sentence_years = models.PositiveIntegerField(default=0)
    restitution_sentence_months = models.PositiveIntegerField(default=0)
    restitution_sentence_days = models.PositiveIntegerField(default=0)

    restitution_sentence_days_total = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        self.restitution_sentence_days_total = (self.restitution_sentence_years * 365) + (self.restitution_sentence_months * 30) + self.restitution_sentence_days
        if not self.restitution_date and self.offence:
            self.restitution_date = self.offence.date_charged
        super().save(*args, **kwargs)


    class Meta:
        db_table = "restitution"

    def clean(self):
        if self.restitution_date < self.offence.date_charged:
            raise ValidationError("Restitution date cannot be before offence date")

class RestitutionPayment(models.Model):
    restitution = models.ForeignKey(Restitution, on_delete=models.CASCADE, related_name="payments")
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    receipt_number = models.CharField(max_length=100)
    receipt_file = models.FileField(upload_to='inmate/restitution_receipts/', blank=True, null=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    recorded_by = models.CharField(max_length=100)

    class Meta:
        db_table = "restitution_payment"
        ordering = ["-payment_date"]

class RestitutionExtension(models.Model):
    """
    Tracks the history of restitution deadline extensions.
    """
    restitution = models.ForeignKey(Restitution, on_delete=models.CASCADE, related_name="extensions")
    date_extended = models.DateField(auto_now_add=True, help_text="Date when the extension was granted")
    previous_date = models.DateField(help_text="The deadline before this extension")
    new_date = models.DateField(help_text="The new extended deadline")
    reason = models.TextField(help_text="Reason for the extension")

    class Meta:
        db_table = "restitution_extension"
        ordering = ["-date_extended"]

    def clean(self):
        if self.new_date <= self.previous_date:
            raise ValidationError("New restitution date must be after the previous date.")


class SentenceGroup(models.Model):
    """
    Groups multiple offences into a single sentence block (e.g. concurrent sentencing).
    """
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="sentence_groups")
    date_of_sentence = models.DateField()
    duration_months = models.PositiveIntegerField(help_text="Sentence duration in months")
    is_concurrent = models.BooleanField(default=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "sentence_group"
        ordering = ["-date_of_sentence"]


class Convicted(models.Model):
    convicted_id = models.AutoField(primary_key=True)

    prison_number = models.ForeignKey(
        Inmate,
        on_delete=models.CASCADE,
        related_name="convictions"
    )

    offence = models.OneToOneField(
        Offence,
        on_delete=models.CASCADE,
        related_name="conviction"
    )

    sentence_group = models.ForeignKey(
        SentenceGroup,
        on_delete=models.CASCADE,
        related_name="convictions",
        null=True,
        blank=True
    )

    date_of_sentence = models.DateField(null=True, blank=True)
    sentence = models.PositiveIntegerField(help_text="Sentence duration in months", null=True, blank=True)
    sentence_start_date = models.DateField(null=True, blank=True)
    sentence_end_date = models.DateField(null=True, blank=True)

    sentence_years = models.PositiveIntegerField(default=0)
    sentence_months = models.PositiveIntegerField(default=0)
    sentence_days = models.PositiveIntegerField(default=0)

    has_fine = models.BooleanField(default=False)
    fine_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    effective_sentence_days = models.PositiveIntegerField(default=0)
    remission_days = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        from dateutil.relativedelta import relativedelta
        base_date = self.date_of_sentence
        if not base_date and self.prison_number:
            base_date = self.prison_number.admission_date
            
        if base_date:
            target_date = base_date + relativedelta(years=self.sentence_years, months=self.sentence_months, days=self.sentence_days)
            calendar_days = (target_date - base_date).days
            self.effective_sentence_days = max(0, calendar_days - 1)
        else:
            self.effective_sentence_days = 0
            
        self.remission_days = self.effective_sentence_days // 3
        super().save(*args, **kwargs)


    class Meta:
        db_table = "convicted"

    def clean(self):
        if self.date_of_sentence < self.offence.date_charged:
            raise ValidationError("Sentence date cannot be before offence charge date")


class Unconvicted(models.Model):
    unconvicted_id = models.AutoField(primary_key=True)

    prison_number = models.ForeignKey(
        Inmate,
        on_delete=models.CASCADE,
        related_name="unconvictions"
    )

    offence = models.OneToOneField(
        Offence,
        on_delete=models.CASCADE,
        related_name="unconviction",null=True,
        blank=True
    )

    next_court_date = models.DateField(null=True, blank=True)
    arrest_date = models.DateField(null=True, blank=True)
    bail_date = models.DateField(null=True, blank=True)
    remand_start_date = models.DateField(null=True, blank=True, help_text="Date remanded into custody")
    remand_end_date = models.DateField(null=True, blank=True, help_text="Date remand ended (conviction or release)")

    class Meta:
        db_table = "unconvicted"

    def clean(self):
        if self.remand_start_date and self.remand_end_date and self.remand_end_date < self.remand_start_date:
            raise ValidationError("Remand end date cannot be before start date.")


class Discharged(models.Model):
    discharged_id = models.AutoField(primary_key=True)
    prison_number = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="discharges")
    offence = models.OneToOneField(Offence, on_delete=models.CASCADE, related_name="discharge")
    
    DISCHARGE_REASON_CHOICES = [
        ("BAIL", "Bail"),
        ("FINE", "Fine"),
        ("ACQUITTED", "Not guilty and acquitted"),
        ("WITHDRAWN", "Withdrawn before/after plea"),
        ("COMMUNITY_SERVICE", "Community service"),
        ("SENTENCE_EXPIRES", "Sentence expires"),
        ("AMNESTY", "Amnesty"),
    ]
    discharge_reason = models.CharField(max_length=50, choices=DISCHARGE_REASON_CHOICES)
    discharge_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "discharged"

    def clean(self):
        if self.discharge_date < self.offence.date_charged:
            raise ValidationError("Discharge date cannot be before offence charge date")


# -----------------------------
# SENTENCE & RELEASE HISTORY
# -----------------------------
class ReleaseHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="release_history")
    APPROVAL_STATUS_CHOICES = [
        ("PENDING", "Pending Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default="PENDING"
    )
    total_effective_sentence = models.PositiveIntegerField(help_text="Total sentence duration in months")
    remission = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(0)],
        help_text="Remission in months"
    )
    earliest_date_of_release = models.DateField()

    total_sentences_days = models.PositiveIntegerField(default=0)
    total_remission_days = models.PositiveIntegerField(default=0)
    odr_standard = models.DateField(null=True, blank=True)
    edr_standard = models.DateField(null=True, blank=True)
    odr_restitution_paid = models.DateField(null=True, blank=True)
    edr_restitution_paid = models.DateField(null=True, blank=True)
    active_edr = models.DateField(null=True, blank=True)
    active_odr = models.DateField(null=True, blank=True)


    class Meta:
        db_table = "release_history"


class ReleaseWorkflow(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="release_workflows")
    STATUS_CHOICES = [
        ("PROPOSED_BY_RECEPTION", "Proposed by Reception"),
        ("HEALTH_ASSESSED", "Health Assessed"),
        ("APPROVED_BY_ADMIN", "Approved by Admin (Released)"),
        ("REJECTED", "Rejected"),
    ]
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="PROPOSED_BY_RECEPTION")
    proposed_date = models.DateTimeField(auto_now_add=True)
    reception_reason = models.TextField(null=True, blank=True)
    reception_receipt = models.FileField(upload_to="discharge_receipts/", null=True, blank=True)
    health_assessment_date = models.DateTimeField(null=True, blank=True)
    health_remarks = models.TextField(null=True, blank=True)
    approved_date = models.DateTimeField(null=True, blank=True)
    admin_remarks = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "release_workflow"
        ordering = ["-proposed_date"]


class ArchivedDischarge(models.Model):
    """
    Stores compressed JSON data of old discharge records (older than 5 years).
    """
    archive_date = models.DateTimeField(auto_now_add=True)
    original_discharge_date = models.DateField()
    inmate_prison_number = models.CharField(max_length=50, null=True, blank=True)
    offence_description = models.TextField()
    discharge_reason = models.CharField(max_length=50)
    compressed_data = models.JSONField(help_text="Full JSON snapshot of the original discharge and offence records")

    class Meta:
        db_table = "archived_discharge"
        ordering = ["-original_discharge_date"]


# -----------------------------
# PROPERTY HISTORY
# -----------------------------
class InmatePropertyHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="property_history")
    bag_number = models.CharField(max_length=50)
    items_description = models.TextField()
    cash_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    date_logged = models.DateField()
    date_released = models.DateField(blank=True, null=True)

    class Meta:
        db_table = "inmate_property_history"


# -----------------------------
# ESCAPE & DISCIPLINE
# -----------------------------
class EscapeHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="escape_history")
    escape_date = models.DateField()
    location = models.CharField(max_length=100)
    recaptured = models.BooleanField(default=False)
    recapture_date = models.DateField(blank=True, null=True)

    class Meta:
        db_table = "escape_history"

    def clean(self):
        if self.recapture_date and not self.recaptured:
            raise ValidationError("Recapture date provided but inmate is not marked as recaptured")
        if self.recapture_date and self.recapture_date < self.escape_date:
            raise ValidationError("Recapture date cannot be before escape date")


class InmateDisciplinaryHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="disciplinary_history")
    offence = models.CharField(max_length=200)
    punishment = models.CharField(max_length=200)
    date = models.DateField()
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "inmate_disciplinary_history"


# -----------------------------
# MEDICAL HISTORY
# -----------------------------
# class InmateMedicalHistory(models.Model):
#     inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="medical_history")
#     condition = models.CharField(max_length=200)
#     diagnosis_date = models.DateField()
#     treatment = models.TextField()
#     medical_officer = models.CharField(max_length=100)
#     remarks = models.TextField(blank=True, null=True)

#     class Meta:
#         db_table = "inmate_medical_history"


# -----------------------------
# DOCUMENT MANAGEMENT
# -----------------------------
class InmateDocument(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=100)
    file = models.FileField(upload_to="inmate/documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inmate_document"


# -----------------------------
# AUDIT TRAIL
# -----------------------------
class InmateAuditTrail(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="audit_trail")
    action = models.CharField(max_length=200)
    performed_by = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "inmate_audit_trail"
        ordering = ["-timestamp"]


# -----------------------------
# SIGNALS
# -----------------------------
@receiver(post_save, sender=RestitutionExtension)
def update_restitution_date(sender, instance, created, **kwargs):
    """Automatically update the main Restitution record when an extension is granted."""
    if created:
        instance.restitution.restitution_date = instance.new_date
        instance.restitution.save()


@receiver(post_save, sender=CourtSession)
def update_next_court_date(sender, instance, created, **kwargs):
    """Automatically update the Unconvicted record when a new court date is set."""
    if created and hasattr(instance.offence, 'unconviction') and instance.offence.unconviction:
        unconvicted = instance.offence.unconviction
        unconvicted.next_court_date = instance.next_court_date
        unconvicted.save()


@receiver(post_save, sender=Convicted)
def close_remand_period(sender, instance, created, **kwargs):
    """
    When an inmate is convicted, set the end date for the remand period
    on the associated Unconvicted record and update Offence status.
    """
    if created:
        # Close the remand period if an unconvicted record exists
        if hasattr(instance.offence, 'unconviction') and instance.offence.unconviction:
            unconvicted = instance.offence.unconviction
            unconvicted.remand_end_date = instance.date_of_sentence
            unconvicted.save()

        # Ensure offence status is updated to CONVICTED
        instance.offence.Offence_status = 'CONVICTED'
        instance.offence.save()


from datetime import timedelta
def calculate_inmate_release_dates(inmate):
    convictions = Convicted.objects.filter(prison_number=inmate)
    
    total_sentences_days = 0
    grouped_convictions = {}
    independent_convictions = []

    for c in convictions:
        if c.sentence_group:
            if c.sentence_group.is_concurrent:
                if c.sentence_group.id not in grouped_convictions:
                    grouped_convictions[c.sentence_group.id] = []
                grouped_convictions[c.sentence_group.id].append(c)
            else:
                independent_convictions.append(c)
        else:
            independent_convictions.append(c)

    date_of_sentence = None
    
    total_years = 0
    total_months = 0
    total_days = 0

    for sg_id, group in grouped_convictions.items():
        if group:
            longest_conviction = max(group, key=lambda c: c.effective_sentence_days)
            total_years += longest_conviction.sentence_years
            total_months += longest_conviction.sentence_months
            total_days += longest_conviction.sentence_days
            for c in group:
                if c.date_of_sentence and (date_of_sentence is None or c.date_of_sentence < date_of_sentence):
                    date_of_sentence = c.date_of_sentence

    for c in independent_convictions:
        total_years += c.sentence_years
        total_months += c.sentence_months
        total_days += c.sentence_days
        if c.date_of_sentence and (date_of_sentence is None or c.date_of_sentence < date_of_sentence):
            date_of_sentence = c.date_of_sentence

    if not date_of_sentence:
        date_of_sentence = inmate.admission_date

    from dateutil.relativedelta import relativedelta
    
    raw_odr = date_of_sentence + relativedelta(years=total_years, months=total_months, days=total_days)
    total_calendar_days = (raw_odr - date_of_sentence).days
    total_sentences_days = max(0, total_calendar_days - 1)

    total_remission_days = total_sentences_days // 3
    days_to_serve = total_sentences_days - total_remission_days

    odr_standard = date_of_sentence + timedelta(days=total_sentences_days) if total_sentences_days > 0 else date_of_sentence
    edr_standard = date_of_sentence + timedelta(days=max(0, days_to_serve - 1)) if days_to_serve > 0 else date_of_sentence

    offences = [c.offence for c in convictions]
    restitutions = Restitution.objects.filter(offence__in=offences)
    
    total_restitution_days = sum(r.restitution_sentence_days_total for r in restitutions)

    if total_restitution_days > 0:
        net_sentences_days = max(0, total_sentences_days - total_restitution_days)
        net_remission_days = net_sentences_days // 3
        net_days_to_serve = net_sentences_days - net_remission_days
        
        odr_restitution_paid = date_of_sentence + timedelta(days=net_sentences_days) if net_sentences_days > 0 else date_of_sentence
        edr_restitution_paid = date_of_sentence + timedelta(days=max(0, net_days_to_serve - 1)) if net_days_to_serve > 0 else date_of_sentence
    else:
        odr_restitution_paid = None
        edr_restitution_paid = None
        net_sentences_days = 0
        net_remission_days = 0

    restitution_valid = False
    if restitutions.exists():
        restitution_valid = True
        for r in restitutions:
            if r.status != 'paid' or not r.receipt:
                restitution_valid = False
                break
    
    if restitution_valid:
        active_edr = edr_restitution_paid
        active_odr = odr_restitution_paid
        active_total_days = net_sentences_days
        active_remission_days = net_remission_days
    else:
        active_edr = edr_standard
        active_odr = odr_standard
        active_total_days = total_sentences_days
        active_remission_days = total_remission_days

    rh, created = ReleaseHistory.objects.get_or_create(
        inmate=inmate, 
        defaults={
            'earliest_date_of_release': active_edr or timezone.now().date(),
            'total_effective_sentence': active_total_days // 30,
        }
    )
    rh.total_sentences_days = active_total_days
    rh.total_remission_days = active_remission_days
    rh.odr_standard = odr_standard
    rh.edr_standard = edr_standard
    rh.odr_restitution_paid = odr_restitution_paid
    rh.edr_restitution_paid = edr_restitution_paid
    rh.active_edr = active_edr
    rh.active_odr = active_odr
    rh.earliest_date_of_release = active_edr or timezone.now().date()
    rh.total_effective_sentence = active_total_days // 30
    rh.remission = active_remission_days / 30.0
    rh.save()

@receiver(post_save, sender=Convicted)
def update_release_dates_on_conviction_save(sender, instance, **kwargs):
    calculate_inmate_release_dates(instance.prison_number)

@receiver(post_delete, sender=Convicted)
def update_release_dates_on_conviction_delete(sender, instance, **kwargs):
    calculate_inmate_release_dates(instance.prison_number)

@receiver(post_save, sender=Restitution)
def update_release_dates_on_restitution_save(sender, instance, **kwargs):
    if instance.offence and hasattr(instance.offence, 'conviction'):
        calculate_inmate_release_dates(instance.offence.conviction.prison_number)

# ==================================================
# CUSTODY / LOCKUP & UNLOCK
# ==================================================

class Yard(models.Model):
    """
    Configurable Yards per station.
    """
    station = models.ForeignKey('Auth.OrgUnit', on_delete=models.PROTECT, related_name='yards')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = "reception_yard"
        ordering = ["display_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.station.code})"


class Cell(models.Model):
    """
    Configurable Cells per yard.
    """
    yard = models.ForeignKey(Yard, on_delete=models.PROTECT, related_name='cells')
    name = models.CharField(max_length=100)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = "reception_cell"
        ordering = ["display_order", "name"]

    def __str__(self):
        return f"{self.name} - {self.yard.name}"


class LockupRecord(models.Model):
    """
    Historical record of a lockup operation.
    """
    station = models.ForeignKey('Auth.OrgUnit', on_delete=models.PROTECT, related_name='lockups')
    date = models.DateField(default=timezone.now)
    time = models.TimeField(default=timezone.now)
    
    total_count = models.PositiveIntegerField(help_text="Cached sum of cell counts")
    status = models.CharField(
        max_length=20, 
        choices=[('SUBMITTED', 'Submitted'), ('CORRECTED', 'Corrected'), ('VOIDED', 'Voided')], 
        default='SUBMITTED'
    )
    notes = models.TextField(blank=True, null=True)
    
    recorded_by = models.ForeignKey('Auth.UserAssignment', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reception_lockup_record"
        ordering = ["-date", "-time"]

    def __str__(self):
        return f"Lockup {self.station.code} - {self.date} {self.time}"


class LockupCellCount(models.Model):
    """
    Individual cell count for a specific lockup record.
    """
    lockup_record = models.ForeignKey(LockupRecord, on_delete=models.CASCADE, related_name='cell_counts')
    yard = models.ForeignKey(Yard, on_delete=models.PROTECT)
    cell = models.ForeignKey(Cell, on_delete=models.PROTECT)
    
    # Immutable historical snapshots
    yard_name_snapshot = models.CharField(max_length=100)
    cell_name_snapshot = models.CharField(max_length=100)
    
    count = models.PositiveIntegerField()

    class Meta:
        db_table = "reception_lockup_cell_count"


class UnlockRecord(models.Model):
    """
    Historical record of an unlock operation.
    """
    station = models.ForeignKey('Auth.OrgUnit', on_delete=models.PROTECT, related_name='unlocks')
    date = models.DateField(default=timezone.now)
    time = models.TimeField(default=timezone.now)
    
    total_count = models.PositiveIntegerField(help_text="Cached sum of cell counts")
    status = models.CharField(
        max_length=20, 
        choices=[('SUBMITTED', 'Submitted'), ('CORRECTED', 'Corrected'), ('VOIDED', 'Voided')], 
        default='SUBMITTED'
    )
    notes = models.TextField(blank=True, null=True)
    
    recorded_by = models.ForeignKey('Auth.UserAssignment', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reception_unlock_record"
        ordering = ["-date", "-time"]

    def __str__(self):
        return f"Unlock {self.station.code} - {self.date} {self.time}"


class UnlockCellCount(models.Model):
    """
    Individual cell count for a specific unlock record.
    """
    unlock_record = models.ForeignKey(UnlockRecord, on_delete=models.CASCADE, related_name='cell_counts')
    yard = models.ForeignKey(Yard, on_delete=models.PROTECT)
    cell = models.ForeignKey(Cell, on_delete=models.PROTECT)
    
    # Immutable historical snapshots
    yard_name_snapshot = models.CharField(max_length=100)
    cell_name_snapshot = models.CharField(max_length=100)
    
    count = models.PositiveIntegerField()

    class Meta:
        db_table = "reception_unlock_cell_count"

@receiver(post_delete, sender=Restitution)
def update_release_dates_on_restitution_delete(sender, instance, **kwargs):
    if instance.offence and hasattr(instance.offence, 'conviction'):
        calculate_inmate_release_dates(instance.offence.conviction.prison_number)
