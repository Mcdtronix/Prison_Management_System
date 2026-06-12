# REQUIREMENTS SPECIFICATION
## Prison Management System: National-Provincial-Station Hierarchy

**Version:** 1.0  
**Date:** 10 May 2026  
**Status:** Phase 0 (Foundation)  
**Author:** Architecture Team  
**Approval Status:** 🟡 PENDING STAKEHOLDER SIGN-OFF  

---

## 1. ORGANIZATIONAL STRUCTURE

### 1.1 Hierarchy Model

The system will operate under a 3-tier hierarchical organizational structure:

```
┌─────────────────────────────────────┐
│  National Headquarters (1)          │
│  - National Admin                   │
│  - 50+ departmental staff           │
│  - Policy & compliance authority    │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┬──────────┬──────────┐
        │             │          │          │
┌───────▼─────┐ ┌─────▼────┐ ┌──▼────┐ ┌──▼────┐
│Province 1   │ │Province2 │ │Province3 │ │...   │
│Admin        │ │Admin     │ │Admin     │ │Province 10
│Dept Staff   │ │Dept Staff│ │Dept Staff│ │Admin+Staff
└───────┬─────┘ └─────┬────┘ └──┬────┘ └──┬────┘
        │             │         │         │
    Stations      Stations   Stations  Stations
    (6-20)        (6-20)     (6-20)   (6-20)
```

### 1.2 Organizational Units

**National HQ (1 total)**
- Single instance, parent to all provincial command centers
- Type: `NATIONAL_HQ`
- Responsible for: System governance, policy definition, audit oversight
- Users: ~50 (national-level departmental staff)
- Admin: National Admin (ADMIN_OFFICER role @ National HQ)

**Provincial Command Centers (10 total)**
- Type: `PROVINCIAL_HQ`
- Parent: National HQ
- Responsible for: Regional operations, station oversight, provincial-level services
- Users per province: ~30-40 (provincial-level departmental staff)
- Admin: Provincial Admin (ADMIN_OFFICER role @ Provincial HQ)

**Prisons/Stations (~120-200 total, 6-20 per province)**
- Type: `STATION`
- Parent: Provincial Command Center
- Responsible for: Daily operations, inmate/officer management, local services
- Users per station: ~25-40 (2-3 per department)
- Admin: Station Admin (ADMIN_OFFICER role @ Station)

### 1.3 Departments

Fixed departmental structure at each organizational level:

**Core Departments** (present at all levels):
1. Reception / Admissions
2. Health / Medical
3. Human Resources / Personnel
4. Stores / Logistics / Supply Chain
5. Farms / Production
6. Finance / Administration
7. Security / Disciplinary
8. Administration / Compliance

**Capacity Planning:**
- National: ~50 users across 8 departments @ National HQ
- Provincial (per province): ~30-40 users across 8 departments @ Provincial HQ
- Station (per station): ~25-40 users (2-3 per department)
- **Total system capacity: ~200-280 concurrent users**

---

## 2. ADMIN ROLE & USER MANAGEMENT

### 2.1 Three-Tier Admin Authorization

#### **National Admin** (ADMIN_OFFICER @ National HQ)

**Scope:** System-wide

**Responsibilities:**
- Create provincial command centers
- Define national policies (data exposure rules, security standards, audit requirements)
- Review system-wide audit logs
- Approve provisioning of provincial admins (nomination + approval workflow)
- Access system-wide aggregated reporting (exposed data only)

**Permissions:**
- Create org units (Provincial level only)
- Assign roles at national HQ (national staff only)
- Approve provincial admin candidates
- View system audit trail
- Define data exposure policies (national scope)
- Generate national reports (aggregated data, not raw records)

**Data Access:**
- Cannot access raw station/provincial data
- Can see only: aggregated statistics, health/compliance reports, exposed datasets

**Cannot:**
- Modify provincial/station user accounts directly
- Create stations
- Override exposure policies (without audit trail)

---

#### **Provincial Admin** (ADMIN_OFFICER @ Provincial HQ)

**Scope:** Own province only

**Responsibilities:**
- Create stations within their province
- Create/manage users at provincial level (provincial departments only)
- Manage users at dependent stations (with station admin coordination)
- Define provincial policies (data exposure, security within province)
- Provincial audit oversight
- Review & approve data exposure from stations to national

**Permissions:**
- Create org units (Station level only, within own province)
- Assign roles (provincial HQ staff and station staff)
- Approve station admin candidates (for own province)
- Assign/modify roles at stations (own province only, coordinated with station admins)
- Manage exposure policies (provincial scope)
- View provincial audit trail

**Data Access:**
- Can see child stations (own province) summary data (exposed data only)
- Cannot see sibling provinces
- Cannot see National HQ internal data

**Cannot:**
- Create new provinces or modify other provinces
- Override national policies
- Force data exposure from stations (only request/approve)

---

#### **Station Admin** (ADMIN_OFFICER @ Station)

**Scope:** Own station only

**Responsibilities:**
- Create/manage users at their station
- Assign roles and department affiliations to staff
- Manage officer assignments and staff status changes
- Define what station data is exposed to provincial/national levels
- Station-level audit trail management
- Request data exposure approvals from provincial admin

**Permissions:**
- Assign roles (station-level staff only)
- Assign department affiliations (own station)
- Create user accounts (own station)
- Suspend/revoke user access (own station)
- Request data exposure (tell provincial/national to access specific data)
- View station audit trail

**Data Access:**
- Full read/write access to own station data (all departments)
- Cannot see other stations
- Cannot see provincial/national internal data

**Cannot:**
- Create new org units
- Approve exposure policies (only request)
- Modify users outside own station

---

### 2.2 User Assignment & Role Binding

**User Assignment Entity Structure:**
```
User (Django auth user)
  ↓
UserAssignment (new model in Phase 1)
  ├─ role (FK to Role: RECEPTION_OFFICER, HEALTH_OFFICER, ADMIN_OFFICER, etc.)
  ├─ org_unit (FK to OrgUnit: National/Provincial/Station)
  ├─ department (FK to Department: Reception, Health, HR, etc.)
  ├─ is_primary (bool: true if this is user's default context)
  └─ is_active (bool: false if revoked)
```

**Workflow for Station Admin Creating User:**

1. **Station Admin** goes to User Management interface
2. Provides user details: name, service number, email, phone
3. Selects role: e.g., "RECEPTION_OFFICER"
4. Selects department: e.g., "Reception"
5. Org unit automatically set to: current station (cannot be changed by station admin)
6. System creates user account with auto-generated temporary password
7. User receives notification email with credentials
8. User logs in, forced to set new password

**Workflow for Provincial Admin Creating User at Provincial Level:**

1. **Provincial Admin** selects: "Create Provincial User"
2. Provides details, selects role (e.g., "FINANCE_OFFICER")
3. Selects department (e.g., "Finance")
4. Org unit automatically set to: current provincial HQ
5. User account created

---

### 2.3 Role Definitions

**System Roles** (fixed list, extendable in future):

| Code | Name | Org Levels | Departments | Permissions |
|------|------|------------|-------------|-------------|
| `SUPER_ADMIN` | Super Administrator | National | All | Full system access, override policies |
| `ADMIN_OFFICER` | Administrative Officer | National/Provincial/Station | Any | See "Admin Role" section (varies by level) |
| `RECEPTION_OFFICER` | Reception/Admissions Officer | Station | Reception | Create/edit inmate records, admissions |
| `HEALTH_OFFICER` | Health Services Officer | Station | Health | Create/manage patient records, health data |
| `HR_OFFICER` | Human Resources Officer | Provincial/Station | HR | Manage officer records, postings, qualifications |
| `STORES_OFFICER` | Stores/Logistics Officer | Station | Stores | Manage inventory, stock movements |
| `FARMS_OFFICER` | Farms Operations Officer | Station | Farms | Manage farm projects, crops, livestock |
| `FINANCE_OFFICER` | Finance Officer | National/Provincial | Finance | Financial records, budgeting (future) |
| `SECURITY_OFFICER` | Security/Disciplinary Officer | Station | Security | Disciplinary records, incidents |
| `REPORTING_OFFICER` | Reporting Officer | National/Provincial | Any | Read-only access to aggregated reports |

**Note:** Roles can be assigned at any org-unit level; permissions are scoped by org-unit + department.

---

## 3. DATA VISIBILITY & ISOLATION

### 3.1 Core Principle

**Data Isolation Rule:**
- **Each user sees only data owned by their assigned organization**
- **Upward visibility (station → provincial → national) is only through explicit exposure policies**
- **Hierarchical override is prohibited unless audited**

### 3.2 Default Access Patterns

| User Org Level | Can Access | Cannot Access | With Policy? |
|----------------|-----------|---------------|--------------|
| **Station** | Own station data (all departments) | Other stations, province, national | Yes: expose to province |
| **Provincial** | Provincial HQ data (own departments) | Stations (blocked by default), national | Yes: stations expose data |
| **National** | National HQ data (own departments) | Provinces, stations (all blocked) | Yes: they expose data |

### 3.3 Data Exposure Policies

**Purpose:** Explicit, audited mechanism for controlled upward visibility

**Policy Defines:**
- Source org unit (who owns data)
- Target org unit (who can see it)
- Module (RECEPTION, HEALTH, etc.)
- Visibility level (SUMMARY only, DETAIL read-only, CUSTOM fields)
- Approval workflow (who approved, when, why)
- Effective dates (start/end)

**Example Policies:**
- Chivhu Station exposes inmate count summary to Harare Province (weekly aggregation)
- Harare Province exposes health statistics (anonymized patient totals) to National
- National mandates health reporting: All provinces expose detailed patient data (for national epidemiology)

**Access via Policy:**
Once approved, user sees only the exposed data, not full raw records.

---

## 4. INITIAL SETUP WORKFLOW

### 4.1 Setup State Machine

System begins in `UNINITIALIZED` state; must complete setup before operations begin.

```
UNINITIALIZED
    ↓
    [Setup Wizard: National HQ creation]
    ↓
SETUP_IN_PROGRESS (can be paused/resumed)
    ↓
    [Setup Wizard: Provincial creation]
    ↓
SETUP_IN_PROGRESS
    ↓
    [Setup Wizard: Station bulk import]
    ↓
SETUP_IN_PROGRESS
    ↓
    [Setup Wizard: User bulk assignment]
    ↓
SETUP_IN_PROGRESS
    ↓
    [System admin: Review & seal]
    ↓
OPERATIONAL (setup disabled)
```

### 4.2 Setup Wizard Flow

**Step 1: National HQ Creation**
- Input: National HQ name, code, country
- Create OrgUnit (type=NATIONAL_HQ)
- Create default departments (Reception, Health, HR, Stores, Farms, etc.)
- Create national admin user
- Output: National HQ org unit created, super admin account ready

**Step 2: Provincial Creation** (interactive or bulk)
- Input: Province list (name, code, parent=National HQ)
- For each province:
  - Create OrgUnit (type=PROVINCIAL_HQ)
  - Create departmental mailboxes
  - Optionally create provincial admin (or do later)
- Output: 10 provincial org units created

**Step 3: Station Bulk Import**
- Input: CSV file (name, code, location, parent_province_code)
- Validate: parent province exists
- Create OrgUnit (type=STATION) for each row
- Output: 100-200 station org units created

**Step 4: User Bulk Assignment**
- Input: CSV file (service_number, full_name, email, role, org_unit_code, department)
- Validate: org unit exists, role valid, department valid
- Create UserAssignment for each row
- Send credential emails to new users
- Output: Initial user assignments created

**Step 5: Review & Seal**
- Audit review: confirm all assignments, check for anomalies
- System admin approves seal
- System transitions to OPERATIONAL
- Setup endpoints disabled
- Normal operations begin

---

## 5. SCALABILITY & CAPACITY TARGETS

### 5.1 User Capacity

**By org level:**
- National HQ: ~50 users
- Provincial (each): ~30-40 users
- Stations (each): ~25-40 users
- **Total: ~200-280 users across 1 national + 10 provincial + 100+ stations**

### 5.2 Concurrent Sessions

**Expected peak loads:**
- 200-280 total users
- ~40-60 concurrent sessions during business hours (per province peak)
- 10-15 concurrent sessions after-hours

### 5.3 Data Volume Projections

| Entity | Annual Growth | Estimated Size |
|--------|---------------|-----------------|
| Inmates | 5,000-10,000 per year | 50,000-100,000 total |
| Officers | 100-200 per year | 1,000-2,000 total |
| Health visits | 20,000-50,000 per year | 200,000+ total |
| Stock movements | 10,000-20,000 per year | 100,000+ total |
| Messages | Varies | 1,000-10,000 per month |

### 5.4 Performance Targets

- Query response: <500ms for list views, <200ms for detail views
- Login response: <2 seconds
- Export (CSV): <30 seconds for annual reports
- Search (full-text): <3 seconds

---

## 6. COMPLIANCE & AUDIT REQUIREMENTS

### 6.1 Data Protection

**Encryption:**
- All passwords: bcrypt (PBKDF2)
- Sensitive fields (national ID, health data): At rest (AES-256)
- In transit: TLS 1.3 + HSTS

**Access logging:**
- All data access (read/write) logged with: user, org unit, timestamp, IP, resource
- Audit logs immutable (append-only)
- 7-year retention minimum

**Segregation:**
- Station data isolated from other stations by default
- Provincial data isolated from other provinces by default
- National data isolated from all operational data

### 6.2 Audit Trail

**Events logged:**
- User login/logout
- User account creation, modification, suspension
- Role/permission changes
- Data exposures (policy creation, approval, revocation)
- All mutations (create, update, delete records)
- Admin actions (policy approvals, system configuration)
- Message sends, reads, deletions

**Audit fields:**
- Who (user assignment)
- What (action type, entity type, resource ID)
- When (timestamp to millisecond)
- Where (IP address, user agent)
- Why (reason/comment, if applicable)

### 6.3 Compliance Checkpoints

- [ ] All mutations logged
- [ ] No data leakage between org units (quarterly security audit)
- [ ] Encryption keys rotated annually
- [ ] Disaster recovery tested semi-annually
- [ ] User access reviews (quarterly by admin)
- [ ] Exposure policy reviews (quarterly)

---

## 7. SIGN-OFF & APPROVAL

**Document Version:** 1.0  
**Prepared by:** Architecture Team  
**Requested Approvals:**

- [ ] **National Commissioner / Project Sponsor**
- [ ] **Chief Information Security Officer (CISO)**
- [ ] **Data Protection Officer (if applicable)**
- [ ] **IT Operations Lead**
- [ ] **Business Process Owners**

**Approval Notes:**
```
[To be filled during sign-off]
```

---

## 8. NEXT STEPS

**Phase 0 (Complete):** Database migration, security audit, requirements specification

**Phase 1 (Weeks 1-4):** Implement hierarchy models, multi-assignment RBAC, access control hardening

**Phase 2 (Weeks 4-6):** Messaging system, exposure policies, setup wizard

**Phase 3 (Weeks 6-8):** Testing, UAT, cutover planning

---

**Approved:** ___________________ **Date:** ___________

**Approved:** ___________________ **Date:** ___________

