# DATABASE SCHEMA DESIGN
## Prison Management System: Phase 1 Model Changes

**Version:** 1.0 (Conceptual)  
**Status:** Phase 0 Planning Document  
**Effective:** Phase 1 Implementation  

---

## 1. ORGANIZATIONAL HIERARCHY MODELS

### 1.1 OrgUnit Model (NEW - Auth App)

Represents every node in the organizational hierarchy (National/Provincial/Station).

```python
class OrgUnit(models.Model):
    """
    Hierarchical organizational unit representing National HQ, Provincial centers, or Stations.
    Forms the backbone of 3-tier tenancy and data isolation.
    """
    
    # Identity
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique identifier (e.g., NAT_HQ_001, HARARE_PROV, CHIVHU_STN)"
    )
    name = models.CharField(
        max_length=150,
        unique=True,
        help_text="Display name (e.g., National Headquarters, Harare Province, Chivhu Station)"
    )
    code_short = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Short code for UI (e.g., NAT_HQ, HARARE, CHV)"
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
        help_text="Organizational level"
    )
    
    # Hierarchy (self-referential FK)
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children',
        db_index=True,
        help_text="Parent organization (National for provinces, province for stations)"
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
        help_text="Active in system"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_org_unit"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["unit_type", "parent", "active"]),
            models.Index(fields=["active"]),
        ]
        constraints = [
            # Enforce hierarchy rules
            models.CheckConstraint(
                check=models.Q(unit_type='NATIONAL_HQ', parent__isnull=True) |
                      models.Q(unit_type='PROVINCIAL_HQ', parent__unit_type='NATIONAL_HQ') |
                      models.Q(unit_type='STATION', parent__unit_type='PROVINCIAL_HQ'),
                name='valid_hierarchy'
            ),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"

# Indexes on hierarchy:
# - (unit_type, parent_id, active): Quick lookup of provinces under national, stations under province
# - (code): Lookup by code
# - (active): Filter to active orgs only
```

**Key design decisions:**
- Self-referential FK enforces hierarchy
- Database constraint prevents invalid parent-child relationships
- Supports quick filtering by level via `unit_type`

---

### 1.2 Department Model (NEW - Auth App)

Master list of departments present at any org level.

```python
class Department(models.Model):
    """
    Master department entity (Reception, Health, HR, Stores, Farms, etc.).
    Fixed list of departments that can exist at any org level.
    """
    
    # Identity
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique code (e.g., RECEPTION, HEALTH, STORES, FARMS)"
    )
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Display name (e.g., Reception/Admissions)"
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
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_department"
        ordering = ["code"]
    
    def __str__(self):
        return f"{self.code} - {self.name}"
```

**Data (seeded on setup):**
```
RECEPTION, Reception/Admissions
HEALTH, Health/Medical Services
HUMAN_RESOURCES, Human Resources/Personnel
STORES, Stores/Logistics/Supply Chain
FARMS, Farms/Production
FINANCE, Finance/Administration
SECURITY, Security/Disciplinary
ADMIN, General Administration
```

---

### 1.3 OrgUnitDepartment Model (NEW - Auth App)

Mapping of which departments exist at which org unit (enables mailbox identity).

```python
class OrgUnitDepartment(models.Model):
    """
    Declares which departments are active at a given organizational unit.
    Enables identity scoping: "Reception@Chivhu", "Health@Harare-Prov", etc.
    Supports bulk user assignment workflow.
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
    
    # Mailbox identity
    mailbox_address = models.EmailField(
        unique=True,
        help_text="Unique mailbox email (e.g., reception@chivhu.pms or health@harare-prov.pms)"
    )
    
    # Status
    active = models.BooleanField(
        default=True,
        db_index=True,
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "auth_org_unit_department"
        unique_together = [("org_unit", "department")]
        indexes = [
            models.Index(fields=["org_unit", "active"]),
            models.Index(fields=["mailbox_address"]),
        ]
    
    def __str__(self):
        return f"{self.department.code}@{self.org_unit.code}"
```

**Example data:**
```
OrgUnit=National HQ, Department=Reception → Reception@national.pms
OrgUnit=Harare Province, Department=Reception → Reception@harare-prov.pms
OrgUnit=Chivhu Station, Department=Reception → Reception@chivhu.pms
OrgUnit=Chivhu Station, Department=Health → Health@chivhu.pms
```

**Why:** Enables mailbox-based identity for Phase 3 messaging system.

---

## 2. USER ASSIGNMENT (MULTI-TENANT IDENTITY)

### 2.1 UserAssignment Model (NEW - Auth App)

Replaces/supplements single `UserProfile` with multi-assignment capability for Phase 1+.

```python
class UserAssignment(models.Model):
    """
    Binds a user to an org unit, department, and role.
    Supports multiple assignments per user (e.g., officer has primary + secondary roles).
    Retirement plan: Phase 2 deprecates UserProfile; Phase 3 deletes it.
    """
    
    # User reference
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assignments',
        db_index=True,
    )
    
    # Assignment details
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='assignments',
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
        help_text="False if revoked"
    )
    
    # Audit
    created_by = models.ForeignKey(
        'UserAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_assignments',
        help_text="Assignment created by (admin)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When assignment was revoked"
    )
    revoked_by = models.ForeignKey(
        'UserAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revoked_assignments',
        help_text="Assignment revoked by (admin)"
    )
    revocation_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for revocation (audit trail)"
    )
    
    class Meta:
        db_table = "auth_user_assignment"
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["user", "is_primary"]),
            models.Index(fields=["org_unit", "department", "is_active"]),
            models.Index(fields=["org_unit", "role", "is_active"]),
        ]
        constraints = [
            # Enforce: max one active primary per user
            models.UniqueConstraint(
                fields=["user", "is_primary"],
                condition=models.Q(is_primary=True) & models.Q(is_active=True),
                name='unique_active_primary_assignment_per_user'
            ),
        ]
    
    def __str__(self):
        status = "PRIMARY" if self.is_primary else "SECONDARY"
        active = "ACTIVE" if self.is_active else "REVOKED"
        return f"{self.user.username} → {self.role.code} @ {self.org_unit.code} ({self.department.code}) [{status}/{active}]"
```

**Schema evolution:**
- Phase 0: UserProfile still primary (backward compat)
- Phase 1: UserAssignment created alongside UserProfile
- Phase 2: Middleware preferentially reads UserAssignment; UserProfile deprecated
- Phase 3: UserProfile deleted; UserAssignment is sole source

---

## 3. DATA EXPOSURE & POLICY MODELS

### 3.1 DataExposurePolicy Model (NEW - Governance App or Auth App)

Defines rules for controlled upward visibility (stations → provincial → national).

```python
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
        help_text="Policy identifier (e.g., CHIVHU_INMATE_SUMMARY_TO_HARARE)"
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
        help_text="JSON list of exposed fields [\"id\", \"name\", \"status\"]"
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
        indexes = [
            models.Index(fields=["source_org_unit", "target_org_unit", "module"]),
            models.Index(fields=["status", "effective_from"]),
        ]
    
    def __str__(self):
        return f"{self.code}: {self.source_org_unit.code} → {self.target_org_unit.code} [{self.status}]"
```

---

### 3.2 DataExposureRecord Model (NEW - Governance App or Auth App)

Record-level exposure tracking (specific inmate to specific provincial HQ, etc.).

```python
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
        unique_together = [("resource_type", "resource_id", "target_org_unit")]
        indexes = [
            models.Index(fields=["resource_type", "resource_id", "revoked_at"]),
        ]
    
    def __str__(self):
        return f"{self.resource_type}#{self.resource_id} → {self.target_org_unit.code}"
```

---

## 4. SYSTEM CONFIGURATION MODEL

### 4.1 SystemConfig Model (NEW - Core App)

Tracks system setup state and configuration.

```python
class SystemConfig(models.Model):
    """
    Singleton configuration for system setup state and initial configuration.
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
        unique=True,  # Only one active config
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
    
    def __str__(self):
        return f"System Config [{self.setup_status}]"
```

---

## 5. DOMAIN MODEL OWNERSHIP ADDITIONS

### 5.1 Models to Update (Add owner_org_unit_id FK)

All existing root records need explicit org-unit ownership for filtering.

**Reception/Inmate:**
```python
class Inmate(models.Model):
    # ... existing fields ...
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        related_name='inmates',
        null=True,  # Temporary for migration; make mandatory post-migration
        db_index=True,
        help_text="Station that admitted/owns this inmate"
    )
    created_by_assignment = models.ForeignKey(
        'Auth.UserAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_inmates',
        help_text="Admin who created record"
    )
```

**Health/Patient:**
```python
class Patient(models.Model):
    # ... existing fields ...
    # RENAME: station → owner_org_unit
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        related_name='patients',
        db_index=True,
    )
```

**Stores/StockReceipt:**
```python
class StockReceipt(models.Model):
    # ... existing fields ...
    receiving_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        related_name='stock_receipts',
        db_index=True,
        help_text="Station that received this stock"
    )
```

**Stores/FeedingSession:**
```python
class FeedingSession(models.Model):
    # ... existing fields ...
    providing_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        related_name='feeding_sessions',
        db_index=True,
        help_text="Station providing feeding"
    )
```

**Farms/FarmProject:**
```python
class FarmProject(models.Model):
    # ... existing fields ...
    owner_org_unit = models.ForeignKey(
        'Auth.OrgUnit',
        on_delete=models.PROTECT,
        related_name='farm_projects',
        db_index=True,
        help_text="Station managing this farm"
    )
```

**HumanResources/OfficerPosting:**
```python
# NEW model tracking officer postings
class OfficerPosting(models.Model):
    """
    Tracks officer assignment to org units over time.
    Replaces implicit Station FK on Officer.
    """
    officer = models.ForeignKey(
        Officer,
        on_delete=models.CASCADE,
        related_name='postings',
    )
    org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.PROTECT,
        related_name='officer_postings',
    )
    posted_from = models.DateField(
        help_text="Start date of posting"
    )
    posted_to = models.DateField(
        null=True,
        blank=True,
        help_text="End date of posting (null = current)"
    )
    
    class Meta:
        db_table = "hr_officer_posting"
        ordering = ["-posted_from"]
```

---

## 6. MIGRATION STRATEGY

### 6.1 Migration Order

1. **Create new hierarchy models** (OrgUnit, Department, OrgUnitDepartment): `Auth/0003_*.py`
2. **Create new user models** (UserAssignment, SystemConfig): `Auth/0004_*.py`
3. **Create exposure models** (DataExposurePolicy, DataExposureRecord): `Auth/0005_*.py`
4. **Add ownership FKs** to domain models: `Reception/0003_*.py`, `Health/0003_*.py`, etc.
5. **Data migrations**:
   - Backfill OrgUnit from Station
   - Backfill UserAssignment from UserProfile
   - Backfill owner_org_unit_id on all domain models
6. **Deprecation Phase 1**: Mark UserProfile as deprecated (still functional)
7. **Deprecation Phase 2**: UserProfile read-only
8. **Deprecation Phase 3**: Delete UserProfile

### 6.2 Backfill Logic

**Station → OrgUnit backfill:**
```
For each existing Station:
  Create OrgUnit(
    code=station.code,
    name=station.name,
    unit_type='STATION',
    parent=<lookup national HQ or first provincial HQ>,
    location=station.location,
    active=station.active
  )
  Map old Station.id → new OrgUnit.id
```

**Inmate backfill (owner_org_unit):**
```
For each Inmate:
  inmate.owner_org_unit_id = <from latest InmateStationHistory.station converted to OrgUnit>
  If no history: inmate.owner_org_unit_id = <default administrative org unit>
```

---

## 7. INDEX STRATEGY

**Critical indexes for performance:**

| Model | Index | Reason |
|-------|-------|--------|
| OrgUnit | (unit_type, parent_id, active) | Filter children by level |
| UserAssignment | (user_id, is_active) + (org_unit_id, role_id, is_active) | Fast user context lookup |
| DataExposurePolicy | (source_org_unit_id, target_org_unit_id, module, status) | Quick policy lookup |
| Inmate | (owner_org_unit_id) | Station-level filtering |
| Patient | (owner_org_unit_id) | Station-level filtering |
| StockReceipt | (receiving_org_unit_id, received_date) | Station/date range queries |
| FarmProject | (owner_org_unit_id) | Station-level filtering |

---

## 8. CONSTRAINTS & VALIDATION

**Database constraints:**
- OrgUnit hierarchy cannot form cycles
- UserAssignment: max 1 active primary per user
- DataExposurePolicy: foreign keys validate hierarchy (can't expose upward without reason)
- SystemConfig: singleton (only one active config)

**Application validation:**
- Admin can only create users at own org level or below
- Admin cannot modify other provinces' users
- Data exposure policy source must be child of target

---

## 9. CAPACITY REFERENCE

**Expected table sizes Year 1:**

| Table | Est. Rows |
|-------|-----------|
| auth_org_unit | 120 (1 national + 10 prov + ~109 stations) |
| auth_department | 8 |
| auth_org_unit_department | ~1,000 (8 depts × 120 units) |
| auth_user_assignment | 300-400 (280 users + secondary roles) |
| auth_data_exposure_policy | 50-100 (policies defined) |
| reception_inmate | 50,000-100,000 |
| health_patient | 50,000+ |
| stores_stock_receipt | 100,000+ |
| farms_farm_project | 200-500 |

---

**Next Phase:** Phase 1 implementation will create these migrations.

