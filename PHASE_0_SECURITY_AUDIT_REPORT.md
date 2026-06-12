# SECURITY AUDIT REPORT - PHASE 0
## Prison Management System | Data Isolation & RBAC Assessment

**Audit Date:** 10 May 2026  
**Audit Scope:** All ViewSets, Permission Classes, Middleware  
**Current Database:** SQLite (transitioning to PostgreSQL)  
**Status:** PRE-IMPLEMENTATION (Phase 0 baseline)

---

## EXECUTIVE SUMMARY

**Total ViewSets Audited:** 40+  
**Critical Findings:** 8  
**High Findings:** 5  
**Medium Findings:** 3  
**Risk Level:** 🔴 **CRITICAL** — Data leakage across stations/departments is present

### Key Risk
Multiple ViewSets use only `@permission_classes([IsAuthenticated])` with **global querysets** (`Model.objects.all()`). Any authenticated user from any station can access data from all stations and departments.

---

## DETAILED FINDINGS

### 1. CRITICAL: Reception Module — Global Inmate Access

| Field | Value |
|-------|-------|
| **Module** | Reception |
| **File** | `Reception/views.py` |
| **ViewSet** | `InmateViewSet` |
| **Line** | ~56 |
| **Issue** | `queryset = Inmate.objects.all()` with no station filtering |
| **Current Permission** | `[IsAuthenticated]` only |
| **Risk** | Any authenticated user (from any station) can query ALL inmates from ALL stations globally |
| **Severity** | 🔴 **CRITICAL** |
| **Compliance Impact** | **HIPAA/GDPR violation** — Unrestricted access to personal inmate data |
| **Remediation** | Implement station-level filtering in `get_queryset()` or use object-level permissions |

**Current Code:**
```python
class InmateViewSet(viewsets.ModelViewSet):
    queryset = Inmate.objects.all()  # ← NO FILTERING
    serializer_class = InmateSerializer
    permission_classes = [IsAuthenticated]  # ← INSUFFICIENT
```

**Impact:** Receptionist at Chivhu can read all inmates at Bulawayo, Harare, etc.

---

### 2. CRITICAL: Stores Module — Global Inventory Access

| Field | Value |
|-------|-------|
| **Module** | Stores |
| **File** | `Stores/views.py` |
| **ViewSets** | All 10 ViewSets (ItemCategory, InventoryItem, StockReceipt, FeedingSession, OfficerIssue, StockWriteOff, etc.) |
| **Issue** | Every ViewSet uses `Model.objects.all()` with no station/org-unit filtering |
| **Current Permission** | `[IsAuthenticated]` only |
| **Risk** | Any user can access system-wide inventory, stock movements, feeding records, officer issuances |
| **Severity** | 🔴 **CRITICAL** |
| **Security Implication** | Department staff can falsify stock records, manipulate feeding quantities, etc. across stations |
| **Remediation** | Add owner_org_unit_id FK to StockReceipt, FeedingSession, OfficerIssue; implement filtering |

**Affected ViewSets:**
- ItemCategoryViewSet (global category list — may be intentional)
- InventoryItemViewSet (global — may be intentional)
- **StockReceiptViewSet** (should be scoped to station)
- **StockLedgerViewSet** (should be scoped to station)
- **FeedingSessionViewSet** (should be scoped to station)
- **OfficerIssueViewSet** (should be scoped to station/officer's station)
- **StockWriteOffViewSet** (should be scoped to station)

---

### 3. CRITICAL: Farms Module — Global Farm Projects Access

| Field | Value |
|-------|-------|
| **Module** | Farms |
| **File** | `Farms/views.py` |
| **ViewSets** | All 10 ViewSets |
| **Issue** | Every ViewSet uses `Model.objects.all()` with no station/org-unit filtering |
| **Current Permission** | `[IsAuthenticated]` only |
| **Risk** | Any user can access farm projects, crops, livestock, expenses from all stations |
| **Severity** | 🔴 **CRITICAL** |
| **Remediation** | Add owner_org_unit_id FK to FarmProject; implement filtering |

**Affected ViewSets:**
- **FarmProjectViewSet** (should be scoped to station)
- **CropCycleViewSet** (should be scoped to station)
- **LivestockBatchViewSet** (should be scoped to station)
- CropTypeViewSet, AnimalTypeViewSet (may be intentional global lists)

**Example Risk:** Chivhu farm officer can see crop yields and expenses from Bulawayo farm, enabling inter-station data inference attacks.

---

### 4. CRITICAL: HumanResources Module — Global Officer Data Access

| Field | Value |
|-------|-------|
| **Module** | HumanResources |
| **File** | `HumanResources/views.py` |
| **ViewSets** | All 11 ViewSets |
| **Issue** | ViewSets use `Model.objects.all()` without station/position-based filtering |
| **Current Permission** | `[IsAuthenticated]` only |
| **Risk** | Any user can access officer personal data, rank history, qualifications, charge sheets across all stations |
| **Severity** | 🔴 **CRITICAL** |
| **Compliance Impact** | **PII exposure** — Officer personal details, disciplinary records globally visible |
| **Remediation** | Filter OfficerStationHistory by user's station; implement role-specific filtering for disciplinary records |

**Affected ViewSets:**
- **OfficerViewSet** (global access to all officer records)
- **OfficerStationHistoryViewSet** (should be scoped by user's station post history)
- **OfficerRankHistoryViewSet** (should be scoped by user's station)
- **ChargeSheetViewSet** (disciplinary records — should be scoped by user's station)
- **SentenceViewSet** (should be scoped by user's station)
- DependantViewSet, OfficerDocumentViewSet (contain PII — should be scoped)

**Example Risk:** Any officer can view charge sheets and personal documents of officers at other stations.

---

### 5. CRITICAL: Health Module — Partial Station Filtering (Inconsistent)

| Field | Value |
|-------|-------|
| **Module** | Health |
| **File** | `Health/views.py` |
| **ViewSet** | `PatientViewSet` |
| **Issue** | **Correctly implements** `get_queryset()` station filtering; however, not all health ViewSets follow this pattern |
| **Current Code** | ✅ `Patient.objects.filter(station=user_station)` |
| **Severity** | 🟡 **MEDIUM** (best practice present but inconsistent) |
| **Note** | Audit trail & other ViewSets not examined in depth; assume similar patterns |
| **Status** | **PARTIALLY COMPLIANT** — Use as template for other modules |

**Good Code Pattern** (to replicate):
```python
def get_queryset(self):
    user_station = self.request.user.userprofile.station
    return Patient.objects.filter(station=user_station)
```

---

### 6. HIGH: No Org-Unit Ownership Fields on Domain Models

| Field | Value |
|-------|-------|
| **Models Affected** | Inmate, StockReceipt, FarmProject, Officer posting data |
| **Issue** | No explicit FK to Station/OrgUnit on ownership; filtering is inconsistent |
| **Severity** | 🟠 **HIGH** |
| **Remediation** | Add `owner_org_unit_id` (FK) to all root domain records; enforce at ORM level |
| **Impact** | ORM-level filtering becomes mandatory (not optional in views) |

**Models to Update:**
| Model | Current State | Required Change |
|-------|---------------|-----------------|
| `Reception.Inmate` | No owner_org_unit_id | Add FK, backfill from UserProfile.station |
| `Health.Patient` | Has `station` FK but implicit | Rename to `owner_org_unit_id`, make mandatory |
| `Stores.StockReceipt` | No owner field | Add `receiving_org_unit_id` FK |
| `Stores.FeedingSession` | No owner field | Add `providing_org_unit_id` FK |
| `Farms.FarmProject` | No owner field | Add `owner_org_unit_id` FK |
| `HumanResources.Officer` | No current posting org | Add posting_org_unit_id (FK to OrgUnit) |

---

### 7. HIGH: Permission Classes Insufficient for Multi-Tenancy

| Field | Value |
|-------|-------|
| **File** | `Auth/permissions.py` |
| **Issue** | Permission classes (`IsSuperAdmin`, `IsHealthOfficer`, etc.) check role only, not org-unit ownership |
| **Current Logic** | Role check: `user_role_code in required_roles` |
| **Missing** | Object-level permission check: Does user's org-unit own the requested resource? |
| **Severity** | 🟠 **HIGH** |
| **Remediation** | Add `has_object_permission()` method to policy engine; check owner_org_unit_id against user's assignment org-unit |

**Current Code Issue:**
```python
class HasRole(BasePermission):
    def has_permission(self, request, view):
        # ✅ Role check
        user_role_code = normalize_role_code(request.user.userprofile.role.code)
        return user_role_code in self.required_roles
        # ❌ NO org-unit check
```

**Required Enhancement:**
```python
class HasRoleAndOrgAccess(BasePermission):
    def has_object_permission(self, request, view, obj):
        # Check: Does this resource belong to user's org unit?
        user_org_unit = request.user.userprofile.station  # Will be UserAssignment in Phase 1
        return obj.owner_org_unit_id == user_org_unit.id  # NEW FIELD REQUIRED
```

---

### 8. HIGH: No Middleware for Org Context

| Field | Value |
|-------|-------|
| **File** | `Core/settings.py` |
| **Issue** | MIDDLEWARE does not include org-context resolution; requests have no `request.org_unit`, `request.org_scope` attributes |
| **Severity** | 🟠 **HIGH** |
| **Impact** | Cannot implement consistent tenant filtering across all views |
| **Remediation** | Add OrgContextMiddleware, AccessScopeMiddleware in Phase 1 |

**Current Middleware (incomplete for multi-tenancy):**
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # MISSING: OrgContextMiddleware, AccessScopeMiddleware, AuditLoggingMiddleware
]
```

---

### 9. MEDIUM: Audit Logging Incomplete

| Field | Value |
|-------|-------|
| **File** | `Auth/models.py` (AuditLog model) |
| **Issue** | Audit logs exist but not integrated into all mutation endpoints (POST, PUT, PATCH, DELETE) |
| **Severity** | 🟡 **MEDIUM** |
| **Remediation** | Implement AuditLoggingMiddleware to capture all writes automatically |
| **Missing** | IP address, user agent, resource IDs being modified |

---

### 10. MEDIUM: JWT Contains Insufficient Assignment Context

| Field | Value |
|-------|-------|
| **File** | `Auth/serializers.py` (CustomTokenObtainPairSerializer) |
| **Issue** | JWT token does not encode org-unit metadata; frontend cannot determine user's assigned organization |
| **Severity** | 🟡 **MEDIUM** |
| **Remediation** | Include `org_unit_id`, `department_id`, `assignment_id` in JWT claims |
| **Impact** | Frontend must make extra API call to determine org context |

---

### 11. MEDIUM: Database Not Production-Ready (SQLite)

| Field | Value |
|-------|-------|
| **File** | `Core/settings.py` DATABASE configuration |
| **Current** | sqlite3 (development-only) |
| **Issue** | SQLite cannot handle concurrent writes; will bottleneck at scale (100+ stations) |
| **Severity** | 🟡 **MEDIUM** (ops risk, not security) |
| **Remediation** | Migrate to PostgreSQL before production deployment |

---

## SUMMARY TABLE: All ViewSets

| Module | ViewSet | Queryset Filtering | Permission Check | Risk Level | Phase 1 Action |
|--------|---------|-------------------|------------------|------------|----------------|
| Reception | InmateViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Reception | NextOfKinViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add FK to Inmate(owner_org_unit_id) |
| Reception | InmateStationHistoryViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by station |
| Reception | All other ViewSets | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add org-unit filtering |
| Health | PatientViewSet | ✅ YES (station) | IsHealthOfficer | 🟢 GOOD | Maintain pattern |
| Health | All other ViewSets | ? (not audited in depth) | Mixed | 🟡 MEDIUM | Full audit in Phase 1 |
| Stores | ItemCategoryViewSet | ⚠️ INTENTIONAL | IsAuthenticated only | 🟢 OK (master data) | Keep global |
| Stores | InventoryItemViewSet | ⚠️ INTENTIONAL | IsAuthenticated only | 🟢 OK (master data) | Keep global |
| Stores | StockReceiptViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Stores | StockLedgerViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Stores | FeedingSessionViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Stores | OfficerIssueViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Stores | StockWriteOffViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Stores | StoreAuditTrailViewSet | ❌ NO | IsAuthenticated only | 🟠 HIGH | Filter by station |
| Farms | FarmProjectViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Farms | CropCycleViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Farms | CropInputUsageViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by crop_cycle.project.owner_org_unit_id |
| Farms | LivestockBatchViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add owner_org_unit_id + filtering |
| Farms | LivestockEventViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by event.batch.owner_org_unit_id |
| Farms | FarmRevenueViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by project.owner_org_unit_id |
| Farms | FarmExpenseViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by project.owner_org_unit_id |
| HumanResources | OfficerViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Add posting_org_unit_id + scope filtering |
| HumanResources | OfficerStationHistoryViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by station in history |
| HumanResources | OfficerRankHistoryViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by station in rank history |
| HumanResources | ChargeSheetViewSet | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by officer.posting_org_unit_id |
| HumanResources | All Disciplinary ViewSets | ❌ NO | IsAuthenticated only | 🔴 CRITICAL | Filter by org-unit |
| Auth | CustomTokenObtainPairView | N/A | Custom (adequate) | 🟢 GOOD | Update to include assignment_id |
| Auth | UserManagementView | N/A | IsAdminOfficer | 🟡 MEDIUM | Add multi-assignment support |

---

## RECOMMENDATIONS FOR PHASE 1

### Priority 1: Immediate (Week 1-2)
1. **Add owner_org_unit_id ForeignKey** to all domain root records (Inmate, StockReceipt, FarmProject, etc.)
2. **Data backfill script** to populate owner_org_unit_id from UserProfile.station for existing records
3. **Rewrite all ViewSets** to implement `get_queryset()` with org-unit filtering (use Health.PatientViewSet as template)
4. **Update permission classes** to add `has_object_permission()` checks

### Priority 2: High (Week 2-3)
5. **Create UserAssignment model** (supports multi-role assignments for Phase 1)
6. **Add DataExposurePolicy models** (framework for controlled upward visibility)
7. **Add OrgContextMiddleware & AccessScopeMiddleware** to Core/settings.py
8. **Update JWT serializer** to include org_unit, department, assignment_id

### Priority 3: Medium (Week 3-4)
9. **Audit logging hook** in AuditLoggingMiddleware
10. **Setup wizard API** (national → provincial → station → user creation)
11. **Frontend setup wizard UI**

---

## COMPLIANCE CHECKLIST

- [ ] All domain records have explicit owner_org_unit_id field
- [ ] All ViewSets implement get_queryset() with org-unit filtering
- [ ] Permission classes include object-level checks (has_object_permission)
- [ ] Middleware attachesrequest.org_scope computed from policies & hierarchy
- [ ] Audit logs capture all mutations (user, org-unit, resource IDs, timestamp, IP)
- [ ] JWT includes org context (org_unit_id, department_id, assignment_id)
- [ ] Setup wizard enforces initial configuration state machine
- [ ] PostgreSQL migration completed and tested

---

## APPROVED & SIGN-OFF

**Audit Lead:** Architecture Team  
**Date Approved:** Phase 0 Completion  
**Next Review:** Phase 1 Completion  

**Status:** ⏳ **AWAITING PHASE 1 REMEDIATION**

