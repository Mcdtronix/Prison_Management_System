from django.db import models
from django.core.validators import RegexValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models.signals import post_save
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
            last = Inmate.objects.filter(prison_number__endswith=f"/{year_suffix}").count() + 1
            self.prison_number = f"{last:04d}/{year_suffix}"
        super().save(*args, **kwargs)

    def clean(self):
        if self.date_of_birth >= self.admission_date:
            raise ValidationError("Admission date must be after date of birth")
        

    def __str__(self):
        return f"{self.prison_number} - {self.surname} {self.first_name}"


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
    Offence_status = models.CharField(max_length=20, choices=[("UNCONVICTED", "Unconvicted"), ("CONVICTED", "Convicted")], default="UNCONVICTED")

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
    outcome = models.CharField(max_length=200, blank=True, null=True, help_text="Outcome (e.g., Remanded, Bail Denied)")
    next_court_date = models.DateField(help_text="The new court date set during this session")
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "court_session"
        ordering = ["-session_date"]

    def clean(self):
        if self.next_court_date <= self.session_date:
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

    class Meta:
        db_table = "restitution"

    def clean(self):
        if self.restitution_date < self.offence.date_charged:
            raise ValidationError("Restitution date cannot be before offence date")

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


# -----------------------------
# SENTENCE & RELEASE HISTORY
# -----------------------------
class ReleaseHistory(models.Model):
    inmate = models.ForeignKey(Inmate, on_delete=models.CASCADE, related_name="release_history")
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

    class Meta:
        db_table = "release_history"


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
