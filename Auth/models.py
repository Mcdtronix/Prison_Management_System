"""
RBAC (Role-Based Access Control) Models
========================================
Production-grade authentication and authorization system for Prison Management System.

Features:
- Role-based access control
- Station-level data isolation
- User profile management
- Audit-ready design
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone


# ==================================================
# ROLE MODEL
# ==================================================
class Role(models.Model):
    """
    System roles defining user permissions.
    Each role grants access to specific modules and actions.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auth_role"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==================================================
# STATION MODEL (Security Boundary)
# ==================================================
class Station(models.Model):
    """
    Prison stations/locations.
    Acts as a security boundary for data isolation.
    Users can only access data from their assigned station.
    """
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auth_station"
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} - {self.name}"


# ==================================================
# USER PROFILE (RBAC Anchor)
# ==================================================
class UserProfile(models.Model):
    """
    Extends Django User with role and station assignment.
    This is the core of RBAC - every user has exactly one role and one station.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="userprofile"
    )
    officer = models.OneToOneField(
        "HumanResources.Officer",
        on_delete=models.PROTECT,
        related_name="system_account",
        blank=True,
        null=True,
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="user_profiles"
    )
    station = models.ForeignKey(
        Station,
        on_delete=models.PROTECT,
        related_name="user_profiles"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profile"
        indexes = [
            models.Index(fields=["role", "station"]),
            models.Index(fields=["is_active"]),
        ]

    def clean(self):
        if not self.user.is_active and self.is_active:
            raise ValidationError("User profile cannot be active if user is inactive")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        identifier = self.officer.service_number if self.officer else self.user.username
        return f"{identifier} - {self.role.code} @ {self.station.code}"


# ==================================================
# AUDIT LOG MODEL
# ==================================================
class AuditLog(models.Model):
    """
    Comprehensive audit trail for all sensitive actions.
    Required for legal compliance and security monitoring.
    """
    MODULE_CHOICES = [
        ("AUTH", "Authentication"),
        ("INMATES", "Inmates"),
        ("HEALTH", "Health"),
        ("STORES", "Stores"),
        ("FARMS", "Farms"),
        ("HR", "Human Resources"),
        ("RBAC", "Role Management"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="audit_logs"
    )
    role = models.CharField(max_length=50)
    station = models.ForeignKey(
        Station,
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
    )

    action = models.CharField(max_length=200)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    object_id = models.CharField(max_length=50, blank=True, null=True)
    object_type = models.CharField(max_length=100, blank=True, null=True)

    # Request metadata
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    request_method = models.CharField(max_length=10, blank=True, null=True)
    request_path = models.CharField(max_length=500, blank=True, null=True)

    # Additional context
    remarks = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["module", "-timestamp"]),
            models.Index(fields=["station", "-timestamp"]),
            models.Index(fields=["role", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp}"


# ==================================================
# ORGANIZATIONAL HIERARCHY MODELS (Phase 1)
# ==================================================

class OrgUnit(models.Model):
    """
    Hierarchical organizational unit representing National HQ, Provincial centers, or Stations.
    Forms the backbone of 3-tier tenancy and data isolation.
    
    Hierarchy enforced via database constraints and application logic:
    - National HQ: parent = None
    - Provincial: parent = National HQ
    - Station: parent = Provincial HQ
    """
    
    # Identity
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique identifier (NAT_HQ_001, HARARE_PROV, CHIVHU_STN)"
    )
    name = models.CharField(
        max_length=150,
        unique=True,
        help_text="Display name (National Headquarters, Harare Province, Chivhu Station)"
    )
    code_short = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Short code for UI (NAT_HQ, HARARE, CHV)"
    )
    
    # Type
    UNIT_TYPES = [
        ('NATIONAL_HQ', 'National Headquarters'),
        ('PROVINCIAL_HQ', 'Provincial Command Center'),
        ('STATION', 'Prison Station'),
    ]
    unit_type = models.CharField(
        max_length=20,
        choices=UNIT_TYPES,
        db_index=True,
        help_text="Organizational level in hierarchy"
    )
    
    # Hierarchy (self-referential FK for parent)
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children',
        db_index=True,
        help_text="Parent organization (National for provinces, Province for stations)"
    )
    
    # Metadata
    location = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Physical location/address"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Operational notes"
    )
    active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Active in system (soft-delete via this field)"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_org_unit"
        ordering = ["code"]
        verbose_name = "Organizational Unit"
        verbose_name_plural = "Organizational Units"
        indexes = [
            models.Index(fields=["unit_type", "parent", "active"]),
            models.Index(fields=["active"]),
            models.Index(fields=["code"]),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_unit_type_display()})"

    def get_root(self):
        """Return the top-level National HQ ancestor."""
        current = self
        while current.parent is not None:
            current = current.parent
        return current
    
    def clean(self):
        """Validate hierarchy constraints"""
        from django.core.exceptions import ValidationError
        
        if self.unit_type == 'NATIONAL_HQ' and self.parent is not None:
            raise ValidationError("National HQ cannot have a parent organization")
        
        if self.unit_type == 'PROVINCIAL_HQ':
            if self.parent is None or self.parent.unit_type != 'NATIONAL_HQ':
                raise ValidationError("Provincial HQ must have National HQ as parent")
        
        if self.unit_type == 'STATION':
            if self.parent is None or self.parent.unit_type != 'PROVINCIAL_HQ':
                raise ValidationError("Station must have Provincial HQ as parent")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Department(models.Model):
    """
    Master list of departments present at any organizational level.
    Fixed set of departments that can exist at National, Provincial, and Station levels.
    """
    
    # Identity
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique code (RECEPTION, HEALTH, STORES, FARMS, etc.)"
    )
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Display name (Reception/Admissions, Health/Medical, etc.)"
    )
    
    # Description
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Department responsibilities & scope"
    )
    
    # Status
    active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Active department"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_department"
        ordering = ["code"]
        verbose_name = "Department"
        verbose_name_plural = "Departments"
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class OrgUnitDepartment(models.Model):
    """
    Mapping of which departments are active at which organizational units.
    Enables departmental identity: "Reception@Chivhu", "Health@Harare-Prov", etc.
    Supports user assignment and messaging mailbox identity.
    """
    
    # Relationships
    org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.CASCADE,
        related_name='departments',
        help_text="Organization (National/Provincial/Station)"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='org_units',
        help_text="Department (Reception, Health, etc.)"
    )
    
    # Mailbox identity (unique per org-unit-department pair)
    mailbox_address = models.EmailField(
        unique=True,
        help_text="Unique mailbox email (e.g., reception@chivhu or health@harare-prov)"
    )
    
    # Status
    active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Active department at this org unit"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_org_unit_department"
        unique_together = [("org_unit", "department")]
        verbose_name = "Organizational Unit Department"
        verbose_name_plural = "Organizational Unit Departments"
        indexes = [
            models.Index(fields=["org_unit", "active"]),
            models.Index(fields=["mailbox_address"]),
        ]
    
    def __str__(self):
        return f"{self.department.code}@{self.org_unit.code}"
    
    def save(self, *args, **kwargs):
        # Auto-generate mailbox address if not provided
        if not self.mailbox_address:
            # Domain for internal mailboxes
            domain = "pms.co.zw"

            # Format mailbox addresses by org level and department
            # Station: {station_code_short}{department_lower}@pms.co.zw  e.g. chivhureception@pms.co.zw
            # Provincial: {province_code_short}{department}@pms.co.zw   e.g. masheastHR@pms.co.zw
            # National: {org_code_short}@pms.co.zw                      e.g. NHQ@pms.co.zw
            try:
                unit = self.org_unit
                dep_code = self.department.code
                if unit.unit_type == 'NATIONAL_HQ':
                    # Use short code for NHQ and keep uppercase
                    self.mailbox_address = f"{unit.code_short.upper()}@{domain}"
                else:
                    # For provinces and stations, concatenate short code and department
                    # Department case preserved for clarity on HR vs reception
                    org_part = unit.code_short.replace(' ', '').lower()
                    dep_part = dep_code if len(dep_code) <= 4 and dep_code.isupper() else dep_code.lower()
                    self.mailbox_address = f"{org_part}{dep_part}@{domain}"
            except Exception:
                # Fallback generic format
                self.mailbox_address = f"{self.department.code.lower()}@{self.org_unit.code.lower()}.{domain}"
        super().save(*args, **kwargs)


class UserAssignment(models.Model):
    """
    Binds a user to an org unit, department, and role.
    Supports multiple assignments per user (primary + secondary roles).
    
    Replaces/supplements single UserProfile model for multi-tenant identity.
    Retirement plan: Phase 2 deprecates UserProfile, Phase 3 deletes it.
    """
    
    # User reference
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='org_assignments',
        db_index=True,
        help_text="Django user account"
    )
    
    # Assignment details
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='org_assignments',
        help_text="Role (RECEPTION_OFFICER, HEALTH_OFFICER, ADMIN_OFFICER, etc.)"
    )
    org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.PROTECT,
        related_name='user_assignments',
        db_index=True,
        help_text="Assigned organization (National/Provincial/Station)"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='user_assignments',
        db_index=True,
        help_text="Assigned department (Reception, Health, etc.)"
    )
    
    # Assignment flags
    is_primary = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Default assignment context for user (only one per user)"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False if assignment is revoked/suspended"
    )
    
    # Audit - created by
    created_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_assignments',
        help_text="Admin who created this assignment"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Audit - revoked by
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When assignment was revoked"
    )
    revoked_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_assignments',
        help_text="Admin who revoked this assignment"
    )
    revocation_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for revocation (audit trail)"
    )
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_user_assignment"
        verbose_name = "User Assignment"
        verbose_name_plural = "User Assignments"
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["user", "is_primary"]),
            models.Index(fields=["org_unit", "department", "is_active"]),
            models.Index(fields=["org_unit", "role", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "is_primary"],
                condition=models.Q(is_primary=True) & models.Q(is_active=True),
                name='unique_active_primary_assignment_per_user',
                violation_error_message="User can have only one active primary assignment"
            ),
        ]
    
    def __str__(self):
        status = "PRIMARY" if self.is_primary else "SECONDARY"
        active = "ACTIVE" if self.is_active else "REVOKED"
        return f"{self.user.username} → {self.role.code} @ {self.org_unit.code}/{self.department.code} [{status}/{active}]"
    
    def clean(self):
        """Validate assignment constraints"""
        from django.core.exceptions import ValidationError
        
        # Check if user already has active primary assignment
        if self.is_primary and self.is_active:
            existing = UserAssignment.objects.filter(
                user=self.user,
                is_primary=True,
                is_active=True
            ).exclude(pk=self.pk).exists()
            if existing:
                raise ValidationError("User already has an active primary assignment")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class DataExposurePolicy(models.Model):
    """
    Policy rule allowing specific data from source org to target org.
    Audit trail of all approvals/revocations.
    No implicit parent visibility; all upward movement requires explicit policy.
    """
    
    # Policy identity
    code = models.CharField(
        max_length=50,
        unique=True,
        help_text="Policy identifier (CHIVHU_INMATE_SUMMARY_TO_HARARE)"
    )
    
    # Visibility direction
    source_org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.CASCADE,
        related_name='exposure_policies_from',
        help_text="Owner of data (e.g., Chivhu Station)"
    )
    target_org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.CASCADE,
        related_name='exposure_policies_to',
        help_text="Recipient of data (e.g., Harare Province)"
    )
    
    # Scope
    module = models.CharField(
        max_length=50,
        choices=[
            ('RECEPTION', 'Inmate/Reception'),
            ('HEALTH', 'Health/Medical'),
            ('STORES', 'Stores/Logistics'),
            ('FARMS', 'Farms/Production'),
            ('HUMAN_RESOURCES', 'HR/Personnel'),
            ('FINANCE', 'Finance'),
            ('SECURITY', 'Security/Disciplinary'),
            ('ALL', 'All modules'),
        ],
        help_text="Which module/data is exposed"
    )
    
    # Visibility level
    VISIBILITY_CHOICES = [
        ('SUMMARY', 'Summary only (aggregated counts, statistics)'),
        ('DETAIL_READ_ONLY', 'Detail-level read access, no export'),
        ('CUSTOM', 'Custom field selection'),
    ]
    visibility_level = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        help_text="What level of detail is exposed"
    )
    
    # Custom fields (if visibility_level=CUSTOM)
    custom_fields = models.JSONField(
        null=True,
        blank=True,
        help_text='JSON list of exposed fields ["id", "name", "status"]'
    )
    
    # Status workflow
    STATUS_CHOICES = [
        ('DRAFT', 'Draft (not active)'),
        ('PENDING_APPROVAL', 'Awaiting approval'),
        ('APPROVED', 'Approved and active'),
        ('REVOKED', 'Revoked'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT',
        db_index=True,
        help_text="Approval status"
    )
    
    # Approval workflow
    approved_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_policies',
        help_text="Admin who approved policy"
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When approved"
    )
    
    # Revocation
    revoked_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_policies',
        help_text="Admin who revoked policy"
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When revoked"
    )
    revocation_reason = models.TextField(
        blank=True,
        null=True,
    )
    
    # Effective dates
    effective_from = models.DateTimeField(
        help_text="Policy becomes active"
    )
    effective_to = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Policy expires (null = no end date)"
    )
    
    # Notes
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Business justification for exposure"
    )
    
    # Audit
    created_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_policies',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_data_exposure_policy"
        verbose_name = "Data Exposure Policy"
        verbose_name_plural = "Data Exposure Policies"
        indexes = [
            models.Index(fields=["source_org_unit", "target_org_unit", "module"]),
            models.Index(fields=["status", "effective_from"]),
        ]
    
    def clean(self):
        from django.core.exceptions import ValidationError
        
        if self.source_org_unit and self.target_org_unit:
            if self.source_org_unit == self.target_org_unit:
                raise ValidationError("Source and target organization units cannot be the same.")
                
            # Check if source is a descendant of target
            current = self.source_org_unit.parent
            is_descendant = False
            while current is not None:
                if current == self.target_org_unit:
                    is_descendant = True
                    break
                current = current.parent
                
            if not is_descendant:
                raise ValidationError("Source organization must be a subordinate (descendant) of the target organization.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code}: {self.source_org_unit.code} → {self.target_org_unit.code} [{self.status}]"


class DataExposureRecord(models.Model):
    """
    Individual record exposed to org unit (e.g., inmate #5234 exposed to Harare Province).
    Tracks confirmation of exposure and revocation.
    """
    
    # Policy context
    policy = models.ForeignKey(
        DataExposurePolicy,
        on_delete=models.CASCADE,
        related_name='records',
        help_text="Policy under which this record is exposed"
    )
    
    # Resource identification
    RESOURCE_TYPES = [
        ('INMATE', 'Inmate'),
        ('PATIENT', 'Patient'),
        ('OFFICER', 'Officer'),
        ('TRANSACTION', 'Financial/Stock Transaction'),
    ]
    resource_type = models.CharField(
        max_length=50,
        choices=RESOURCE_TYPES,
        db_index=True,
        help_text="Type of resource exposed"
    )
    resource_id = models.IntegerField(
        db_index=True,
        help_text="ID of resource (inmate.id, patient.id, etc.)"
    )
    
    # Target org
    target_org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.CASCADE,
        related_name='exposed_records',
        help_text="Org unit that can see this record"
    )
    
    # Exposure tracking
    exposed_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        related_name='exposed_records',
        help_text="Admin who exposed record"
    )
    exposed_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When exposed"
    )
    
    # Revocation
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When exposure revoked (soft-delete)"
    )
    revoked_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_records',
        help_text="Admin who revoked exposure"
    )
    
    class Meta:
        db_table = "auth_data_exposure_record"
        verbose_name = "Data Exposure Record"
        verbose_name_plural = "Data Exposure Records"
        unique_together = [("resource_type", "resource_id", "target_org_unit")]
        indexes = [
            models.Index(fields=["resource_type", "resource_id", "revoked_at"]),
        ]
    
    def __str__(self):
        return f"{self.resource_type}#{self.resource_id} → {self.target_org_unit.code}"


class SystemConfig(models.Model):
    """
    Singleton configuration for system setup state and initial configuration.
    Tracks initial system setup progress and state machine.
    """
    
    # Setup state
    SETUP_STATES = [
        ('UNINITIALIZED', 'Awaiting first setup'),
        ('IN_PROGRESS', 'Setup wizard in progress'),
        ('READY', 'Setup complete, ready for operations'),
        ('OPERATIONAL', 'Normal operations ongoing'),
    ]
    setup_status = models.CharField(
        max_length=20,
        choices=SETUP_STATES,
        default='UNINITIALIZED',
        help_text="Current setup state of system"
    )
    
    # National HQ reference
    national_hq = models.OneToOneField(
        OrgUnit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='system_config',
        help_text="Reference to National HQ org unit"
    )
    
    # Setup metadata
    setup_sealed_by = models.ForeignKey(
        UserAssignment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sealed_configs',
        help_text="Admin who sealed setup"
    )
    setup_sealed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When setup was sealed"
    )
    setup_sealed_reason = models.TextField(
        blank=True,
        null=True,
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "core_system_config"
        verbose_name = "System Configuration"
        verbose_name_plural = "System Configurations"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.pk and SystemConfig.objects.exists():
            raise ValidationError("Only one SystemConfig instance can exist. It is a singleton.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"System Config [{self.setup_status}]"
