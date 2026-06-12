from django.db import models
from django.core.validators import RegexValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone


# =====================================================
# CORE OFFICER ENTITY (STATIC IDENTITY)
# =====================================================
class Officer(models.Model):
    SERVICE_NUMBER_REGEX = r"^[0-9]{7}[A-Z]$"

    service_number = models.CharField(
        max_length=8,
        primary_key=True,
        validators=[
            RegexValidator(
                regex=SERVICE_NUMBER_REGEX,
                message="Service number must be in the format 2934823Z",
            )
        ],
    )
    first_name = models.CharField(max_length=100)
    surname = models.CharField(max_length=100)
    other_names = models.CharField(max_length=100, blank=True, null=True)
    national_id = models.CharField(
        max_length=20,
        unique=True,
        validators=[
            RegexValidator(
                r"^[0-9]{2}-[0-9]{6,7}\s?[A-Z]\s?[0-9]{2}$",
                "Invalid National ID format",
            )
        ],
    )
    gender = models.CharField(max_length=10, choices=[("Male", "Male"), ("Female", "Female")])
    date_of_birth = models.DateField()
    date_of_attestation = models.DateField()
    date_of_retirement = models.DateField(blank=True, null=True)
    current_status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("SUSPENDED", "Suspended"),
            ("RETIRED", "Retired"),
            ("DISMISSED", "Dismissed"),
            ("DECEASED", "Deceased"),
        ],
        default="ACTIVE",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "officer"
        ordering = ["surname", "first_name"]

    def clean(self):
        # Only compare if both dates are provided
        if self.date_of_birth and self.date_of_attestation:
            if self.date_of_birth >= self.date_of_attestation:
                raise ValidationError("Date of attestation must be after date of birth")

        if self.date_of_retirement and self.date_of_attestation:
            if self.date_of_retirement < self.date_of_attestation:
                raise ValidationError("Date of retirement cannot be before attestation")


    def __str__(self):
        return f"{self.service_number} - {self.surname} {self.first_name}"


# =====================================================
# REFERENCE / LOOKUP TABLES
# =====================================================
class MaritalStatus(models.Model):
    name = models.CharField(max_length=20, unique=True)

    class Meta:
        db_table = "marital_status"

    def __str__(self):
        return self.name


class Rank(models.Model):
    name = models.CharField(max_length=100, unique=True)
    rank_level = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "rank"
        ordering = ["rank_level"]

    def __str__(self):
        return self.name


# Note: Station model is now in Auth app (Auth.Station)
# This ensures consistency across the system and RBAC integration

class QualificationType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "qualification_type"

    def __str__(self):
        return self.name


class Course(models.Model):
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50)
    issuing_authority = models.CharField(max_length=200)

    class Meta:
        db_table = "course"

    def __str__(self):
        return self.name


# =====================================================
# HISTORICAL / TRANSACTIONAL TABLES
# =====================================================
class OfficerStationHistory(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="station_history")
    station = models.ForeignKey('Auth.Station', on_delete=models.PROTECT)
    date_posted = models.DateField()
    date_transferred = models.DateField(blank=True, null=True)
    posted_by = models.CharField(max_length=100)
    posting_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='officer_postings',
        db_index=True,
        help_text="Organization unit where officer is posted (replaces Station FK)."
    )

    class Meta:
        db_table = "officer_station_history"
        ordering = ["-date_posted"]

    def clean(self):
        if self.date_transferred and self.date_transferred < self.date_posted:
            raise ValidationError("Transfer date cannot be earlier than posting date")
        if self.date_posted < self.officer.date_of_attestation:
            raise ValidationError("Posting date cannot be before attestation")


class OfficerRankHistory(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="rank_history")
    rank = models.ForeignKey(Rank, on_delete=models.PROTECT)
    effective_date = models.DateField()
    change_type = models.CharField(
        max_length=20,
        choices=[("PROMOTION", "Promotion"), ("DEMOTION", "Demotion"), ("ACTING", "Acting")],
    )
    authority = models.CharField(max_length=100)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "officer_rank_history"
        ordering = ["-effective_date"]

    def clean(self):
        if self.effective_date < self.officer.date_of_attestation:
            raise ValidationError("Rank effective date cannot be before attestation")


class OfficerQualification(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="qualifications")
    qualification_type = models.ForeignKey(QualificationType, on_delete=models.PROTECT)
    institution = models.CharField(max_length=200)
    date_awarded = models.DateField()
    certificate = models.FileField(upload_to="officers/qualifications/")

    class Meta:
        db_table = "officer_qualification"

    # def clean(self):
    #     if self.date_awarded < self.officer.date_of_attestation:
    #         raise ValidationError("Qualification award date cannot be before attestation")


class OfficerCourseHistory(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="courses")
    course = models.ForeignKey(Course, on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField()
    result = models.CharField(max_length=50)
    certificate = models.FileField(upload_to="officers/courses/", blank=True, null=True)

    class Meta:
        db_table = "officer_course_history"

    def clean(self):
        if self.end_date < self.start_date:
            raise ValidationError("Course end date cannot be before start date")


# =====================================================
# DISCIPLINARY & LEGAL HISTORY
# =====================================================
class OffenceType(models.Model):
    name = models.CharField(max_length=200)
    severity_level = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "offence_type"

    def __str__(self):
        return self.name


class ChargeSheet(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="charge_sheets")
    offence_type = models.ForeignKey(OffenceType, on_delete=models.PROTECT)
    charge_date = models.DateField()
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[("PENDING", "Pending"), ("CONCLUDED", "Concluded"), ("WITHDRAWN", "Withdrawn")],
    )
    document = models.FileField(upload_to="officers/charges/")

    class Meta:
        db_table = "charge_sheet"

    def clean(self):
        if self.charge_date < self.officer.date_of_attestation:
            raise ValidationError("Charge date cannot be before attestation")


class Sentence(models.Model):
    charge_sheet = models.OneToOneField(ChargeSheet, on_delete=models.CASCADE, related_name="sentence")
    sentence_type = models.CharField(max_length=100)
    sentence_date = models.DateField()
    duration_months = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "sentence"

    def clean(self):
        if self.sentence_date < self.charge_sheet.charge_date:
            raise ValidationError("Sentence date cannot be earlier than charge date")


# =====================================================
# DEPENDANTS
# =====================================================
class Dependant(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="dependants")
    full_name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    national_id = models.CharField(max_length=20, blank=True, null=True)
    birth_certificate = models.FileField(upload_to="officers/dependants/")

    class Meta:
        db_table = "dependant"

    def clean(self):
        if self.date_of_birth >= timezone.now().date():
            raise ValidationError("Dependant date of birth must be in the past")


# =====================================================
# DOCUMENT MANAGEMENT
# =====================================================
class OfficerDocument(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=100)
    file = models.FileField(upload_to="officers/documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "officer_document"


# =====================================================
# AUDIT TRAIL
# =====================================================
class OfficerAuditTrail(models.Model):
    officer = models.ForeignKey(Officer, on_delete=models.CASCADE, related_name="audit_trail")
    action = models.CharField(max_length=200)
    performed_by = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "officer_audit_trail"
        ordering = ["-timestamp"]
