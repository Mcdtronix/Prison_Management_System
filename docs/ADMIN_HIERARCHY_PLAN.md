# Three-Tier Administration: Implementation Plan

**System:** Prison Management System (pms.mcdtronix.co.zw)
**Scope:** National HQ (Super Admin) → Provincial Command Centre (Provincial Admin) → Station (Station Admin)
**Status:** Proposal. Nothing in this document is implemented yet.
**Date:** 2026-11-03

---

## 0. Executive summary

The codebase already has the right foundations: an `OrgUnit` tree (NHQ → Province → Station), `Department`, multi-role `UserAssignment`, scope-computing middleware and a data-exposure policy model. The three admin tiers can be built on these foundations rather than started from scratch.

Four things stand in the way:

1. **The live system has a critical privilege-escalation vulnerability** (§1). Any logged-in user can make themselves a national Super Admin. This was confirmed by test. It must be fixed before any feature work.
2. **Two permission systems run side by side.** The legacy one is `UserProfile` + `Station`; the new one is `UserAssignment` + `OrgUnit`. Permission checks, audit logging and data ownership disagree about which one is authoritative. Ten model FKs still point at the legacy `Station`.
3. **Admin tiers are implicit.** One role (`ADMIN_OFFICER`) means "admin", and its reach depends only on where it is assigned. There is no rule about which roles an admin may grant, so escalation is structurally possible.
4. **Several requested features need new infrastructure.** "Who is online", "force logout" and "reset password safely" need server-side sessions, which stateless JWT doesn't provide today. "How much of the database each unit holds" needs a usage-metering job.

**Two requested items are changed deliberately:**

| Requested | Delivered instead | Why |
|---|---|---|
| Admins can see each user's hashed password | Admins see **password health**: last changed, expiry, must-change flag, failed attempts, lock state, MFA status | A hash is a crackable credential and has no administrative use (§5.3). |
| "Ability to reset user password" | **One-time temporary credential** with forced change at next login, all sessions revoked, fully audited, and tier rules on who may reset whom | The admin never knows the user's real password, and a lower tier can't take over a higher one (§5.4). |

---

## 1. Security findings (fix first: Phase 0)

Found by reading the code. **F1 and F2 were confirmed with an automated test** against the current code.

| # | Severity | Finding | Where |
|---|---|---|---|
| F1 | **Critical** | Any authenticated user can `POST /api/auth/user-assignments/` to give themselves `SUPER_ADMIN` at National HQ. The test showed a reception clerk going from `admin.create_phq = False` to `True` (HTTP 201). | `Auth/views_rbac.py` `UserAssignmentViewSet` (permission = `IsAuthenticated` only; serializer `fields='__all__'`) |
| F2 | **Critical** | Any authenticated user can create, edit or delete **roles** and **departments** (test: HTTP 201). | `RoleViewSet`, `DepartmentViewSet` |
| F3 | **Critical** | Any authenticated user can create or **approve** data-exposure policies. Approval works by writing the `status` field directly. | `DataExposurePolicyViewSet`, `DataExposureRecordViewSet` |
| F4 | High | An admin creating an org admin can assign **any** active role, including `SUPER_ADMIN`. A provincial admin can therefore mint a national super admin. | `CreateAdminSerializer.role`, `AdminWorkflowViewSet.create_admin` |
| F5 | High | `create_station` skips the scope check when `parent` is missing or invalid, because `target_org=None` means "unscoped". | `AdminWorkflowViewSet.create_station` |
| F6 | High | Audit log API is not scoped. Any `ADMIN_OFFICER` at any station can read and export **national** logs. A scoped permission class (`IsScopedAdmin`) exists but is never used. | `Auth/views_audit.py` |
| F7 | High | Users who exist only in the new model (`UserAssignment`, with no legacy `UserProfile`) produce **no audit records** for API mutations. The middleware skips them with only a log warning. | `Core/middleware/audit_logging.py` |
| F8 | High | Records with a `NULL` owner are visible to **every** org unit. Models that use a field named `station` aren't scoped by the global filter at all. | `Core/filters.py` (`__isnull=True` branch; `station` not in `ORG_FIELDS`) |
| F9 | Medium | `IsStationDataOwner` compares legacy `station_id` (an `auth_station` id) with an `OrgUnit` id. These are different tables, so matches are coincidental. It also allows access when the owner is `NULL`. | `Auth/permissions.py` |
| F10 | Medium | Tokens can't be revoked. `token_blacklist` isn't installed, so `BLACKLIST_AFTER_ROTATION` does nothing and logout revokes nothing. Access tokens live **8 hours**, so a disabled or reset user keeps access until the token expires. | `Core/settings.py`, `logout_view` |
| F11 | Medium | Admin-created accounts skip password validation. `CreateAdminSerializer` calls `create_user` without `validate_password`, and there is no forced change after an admin sets a password. | `Auth/serializers_admin.py` |
| F12 | Low | `AuditLog.role` stores the **username** for RBAC actions (`role=request.user.username`), and `AuditLog.station` points at the legacy table. | `views_admin.py`, `signals.py` |
| F13 | Low | The Django admin site (`/admin/`) is reachable from the internet and protected only by a password. | nginx `pms.conf` |

**Phase 0 must also check the production database for past abuse of F1 to F4:** any `UserAssignment` with an admin role that a non-superuser created, and any `Role`, `Department` or `DataExposurePolicy` rows that nobody recognises.

---

## 2. Target role model

### 2.1 Explicit tiers

Add two fields to `Role`:

- `tier`: `NATIONAL` · `PROVINCIAL` · `STATION` · `OPERATIONAL`
- `assignable_at`: the `unit_type` the role may be assigned at

| Role code | Tier | Assignable at | Purpose |
|---|---|---|---|
| `NATIONAL_SYSTEM_ADMIN` | NATIONAL | NATIONAL_HQ | HQ system administration (the "Super Admin") |
| `PROVINCIAL_SYSTEM_ADMIN` | PROVINCIAL | PROVINCIAL_HQ | Administers one province and its stations |
| `STATION_SYSTEM_ADMIN` | STATION | STATION | Administers one station |
| `AUDITOR` *(read-only)* | per scope | any | Compliance review, no write access |
| Operational roles (`RECEPTION_OFFICER`, `HEALTH_OFFICER`, …) | OPERATIONAL | as configured | Day-to-day work |

`SUPER_ADMIN` and `ADMIN_OFFICER` are migrated to these codes. `normalize_role_code` keeps the old codes working during the transition.

**Django's `is_superuser`** is restricted to **two named break-glass accounts**. Those accounts require MFA, every use triggers an alert, and they are not used for daily work. Today `is_superuser` bypasses every check (`rbac.py` line 96), which makes it the most valuable target in the system.

### 2.2 Two rules that prevent escalation

Every admin action is checked against both rules **on the server**:

1. **Scope rule.** The target org unit must be the admin's own unit or one of its descendants. This is already implemented in `_org_in_scope`.
2. **Grant rule.** An admin may grant, revoke or reset only roles and users **strictly below their own tier**. They may never grant a role at their own tier or above, and never act on themselves.

| Actor ↓ / may grant → | National admin | Provincial admin | Station admin | Operational |
|---|---|---|---|---|
| National admin | ✖ (two-person rule, §6) | ✔ | ✔ | ✔ |
| Provincial admin | ✖ | ✖ | ✔ (own province) | ✔ (own province) |
| Station admin | ✖ | ✖ | ✖ | ✔ (own station) |

Together, these two rules close F1 and F4 structurally rather than case by case.

### 2.3 One permission engine

`Auth/rbac.py` becomes the **single** authority:

- `can(user, capability, target_org)` returns allow or deny. It is the only function views call. Role-name checks in views are removed.
- `can_manage_user(actor, target_user)` applies the scope and grant rules to the target user's assignments.
- `grantable_roles(actor, org_unit)` drives both validation and the dropdowns in the UI.
- `admin_scope(user)` returns the queryset of org units this admin governs.

The capability map moves from a Python dict to a `RoleCapability` table, editable only by national admins with two-person approval. Every role-only `HasRole` subclass in `Auth/permissions.py` is replaced by a single `Capability("x.y")` permission class.

### 2.4 Separation of duties (recommended)

System administrators manage **accounts, org structure and audit**. They don't automatically get **operational data** such as inmate files, medical records or cases. A provincial IT admin has no need to read a prisoner's health record.

- Admin roles get no `health.*`, `reception.*` or other operational capabilities by default.
- Someone who needs both gets **two assignments**, each audited separately.
- A national admin can request **break-glass** read access to operational data. It requires a written reason, lasts 1 hour, and alerts the provincial admin.

This is a policy decision for the organisation. The engine supports either choice, but least privilege is the recommendation.

---

## 3. Capabilities per tier

`★` = beyond what was asked; recommended.

### 3.1 National System Admin (HQ)

**Structure**
- Create, rename and deactivate provincial command centres. Deactivation is soft-delete only and is blocked while active stations exist.
- Manage the **department catalogue** and which departments exist at which units.
- ★ Move a station to another province, as a two-person operation with the change history preserved.

**People and access**
- Create, suspend and reactivate provincial admins (two-person rule for other national admins).
- Assign and revoke roles anywhere, following the grant rule.
- Reset credentials for any user below the national tier.
- ★ Manage the role and capability catalogue (two-person rule).
- ★ Bulk actions: suspend all users of a unit, for example when a station is compromised.

**Oversight**
- National directory: provinces → stations → users, with role, department, email, status, last login, MFA and password health.
- **Who is online**, nationally, filterable by province and station. Includes device, IP and login time, with **force logout**.
- **Activity stream**: who did what, when, from where, and what changed (before and after values). Searchable and exportable.
- **Data footprint** per province and station: record counts per module, estimated storage, media storage, and share of the national total (§5.5).

**Security and governance** ★
- System security policy: password rules, session lifetime, lockout thresholds, MFA enforcement.
- Security alerts: failed-login spikes, logins outside working hours, privilege changes, break-glass use, a dormant account becoming active.
- **Access recertification**: each quarter, provincial admins confirm their station admins and station admins confirm their users. Accounts not confirmed are suspended automatically.
- Approve data-exposure policies between units.
- System health view: last deploy, last backup and its verification, error rate.
- Maintenance mode and system-wide announcements.

### 3.2 Provincial System Admin

Everything below is limited to **their own province and its stations**.

- Create and deactivate stations. ★ Configure departments per station.
- Create, suspend and reactivate station admins. Assign roles below the provincial tier.
- Reset credentials for station admins and station users in the province.
- Directory of all users in the province, with the same fields as national.
- Who is online in the province, with force logout.
- Activity stream for the province and its stations.
- Data footprint per station, and the province's share of the national total.
- ★ Approve **inter-station officer transfers** within the province (connects to the HR posting history).
- ★ Recertify station admins quarterly.
- ★ Escalate to national: security incidents, requests for cross-province data exposure.
- ★ Provincial security alerts, such as repeated failed logins at a station.

### 3.3 Station System Admin

Everything below is limited to **their own station**.

- Create user accounts. Accounts are created **from the HR officer roster** (`Officer` with status ACTIVE), so staff who don't exist in HR can't get accounts. This matches today's design.
- Assign and revoke operational roles and departments.
- Reset credentials for operational users.
- ★ Unlock accounts locked by failed logins.
- Station directory, who is online, force logout.
- Station activity stream and failed-login log.
- Station data footprint.
- ★ **Automatic offboarding**: when HR marks an officer as transferred, suspended, retired or deceased, their account is suspended at once and their sessions are revoked.
- ★ **Dormant accounts**: no login for 60 days locks the account automatically; the station admin can reactivate it.
- ★ Quarterly user recertification.
- ★ Shift handover report: who logged in during a shift and what they changed.

### 3.4 Shared rules for all tiers

- Admins **cannot** edit, reset, suspend or re-role **themselves**.
- Every admin action records actor, tier, target, scope, reason (required for resets, suspensions and role changes), IP and before/after values.
- Admin accounts must use **MFA**.
- Every list, count and export is filtered by `admin_scope()` on the server. The frontend only hides buttons; it is never the security boundary.

---

## 4. Data model changes (PostgreSQL)

### 4.1 Consolidate onto `OrgUnit` (removes the dual system)

| Step | Change |
|---|---|
| 1 | Data migration: every `Station` gets a matching `OrgUnit(unit_type=STATION)` (match by code), and every `UserProfile` gets a primary `UserAssignment`. |
| 2 | For each of the **10 FKs to `Auth.Station`** (Health ×8, Reception ×1, HR ×1), add `owner_org_unit`, backfill it via the code map, and make it `NOT NULL`. |
| 3 | Switch reads to `owner_org_unit`. Keep the old column read-only for one release. |
| 4 | Drop the legacy `station` FKs, then `UserProfile` and `Station`, in a later release. |

All four steps are backward-compatible within a deploy, as required by the migration rules in `docs/DEPLOYMENT.md` §5.

**Ownership rule:** every operational record has a **non-null `owner_org_unit`**. The `__isnull=True` visibility branch in `Core/filters.py` is removed, which closes F8.

### 4.2 New and changed tables

```text
auth_role                  + tier, assignable_at, is_admin_role
auth_role_capability       role_id, capability            (replaces the dict in rbac.py)

auth_user_security         user_id (1:1)
                           must_change_password, password_changed_at, password_expires_at,
                           failed_attempts, locked_until, mfa_enabled, mfa_secret (encrypted),
                           last_seen_at, dormant_locked_at

auth_user_session          id (uuid = JWT "sid" claim), user_id, org_unit_id,
                           created_at, last_seen_at, ip, user_agent,
                           revoked_at, revoked_by, revoke_reason
                           index (user_id, revoked_at), index (org_unit_id, last_seen_at)

auth_login_event           user_id (nullable), username_attempted, success, reason,
                           ip, user_agent, org_unit_id, at        (index: at, ip, user_id)

audit_log                  + org_unit_id (FK OrgUnit, replaces station), actor_role (real code),
                           + actor_tier, target_user_id, reason, changes JSONB (before/after),
                           + request_id, prev_hash, hash          (tamper evidence, §5.6)

org_usage_snapshot         org_unit_id, module, table_name, row_count, est_bytes,
                           media_bytes, captured_at        (one row per unit/table per night)

access_review              reviewer_id, org_unit_id, period, status, completed_at
access_review_item         review_id, user_id, decision (KEEP/REVOKE), decided_at
```

### 4.3 Database-level safeguards

- **Append-only audit:** a PostgreSQL trigger rejects `UPDATE` and `DELETE` on `audit_log` and `auth_login_event` for the application role. Retention purges run as a separate maintenance role.
- **Indexes:** `audit_log (org_unit_id, timestamp DESC)`, `(user_id, timestamp DESC)`, plus a **BRIN** index on `timestamp`, which stays small and fast for append-only time series.
- **Partitioning:** monthly range partitions on `audit_log` once it passes about 10M rows. That is not needed at today's volume and is listed so it isn't forgotten.
- **Optional, later:** PostgreSQL row-level security on operational tables keyed by `owner_org_unit`, as a second line of defence if application scoping fails. It is powerful but adds operational complexity, so it should come after the application layer is correct.

---

## 5. How the requested features work

### 5.1 Who is online

JWT is stateless, so the server currently doesn't know who is logged in. The fix:

1. Login creates an `auth_user_session` row. Its id goes into the JWT as the `sid` claim.
2. A custom `JWTAuthentication` subclass rejects tokens whose session is revoked, and updates `last_seen_at` **at most once per 60 seconds** per session, so there's no database write on every request.
3. "Online" means `last_seen_at` is within the last 5 minutes and the session isn't revoked.
4. The frontend sends a lightweight heartbeat every 2 minutes while the tab is visible, so idle-but-open screens still count.
5. **Force logout** sets `revoked_at`. The user's next request fails within one access-token lifetime.

Token lifetimes change from 8 h access / 7 d refresh to **15 min access / 12 h refresh (one shift)**, and `rest_framework_simplejwt.token_blacklist` is installed so logout and resets actually revoke tokens (closes F10).

### 5.2 Who did what and when

- **Every** authenticated mutation is logged, for both legacy and new-model users (closes F7), with the real role code and the `OrgUnit`.
- Sensitive model changes (users, assignments, roles, inmate status, releases) record **before/after values** in `changes`.
- Reads of high-sensitivity records, such as medical files and the inmate dossier, are logged too. These are the "who looked at this prisoner's file" questions an investigation will ask.
- The activity stream is scoped by `admin_scope()`: national sees all, provincial sees its province, station sees its station.

### 5.3 Password hashes: why they aren't shown

Django stores passwords as salted PBKDF2 hashes. Showing them to admins:

- gives anyone who can read the admin screen (or a screenshot, export or compromised admin session) material to crack offline, and officers reuse passwords;
- has **no operational use**, since an admin can't do anything with a hash;
- turns the admin console into a credential-dumping tool and breaks the principle that only the user knows their password.

**Admins see this instead:** password last changed, expiry date, "must change at next login", failed attempts, locked until, MFA on/off, and whether the hash uses the current algorithm. That answers every legitimate admin question.

### 5.4 Password reset

1. The admin selects a user. The server checks the **scope and grant rules**, and an admin can't reset their own password.
2. The admin enters a required **reason**.
3. The server generates a **random one-time temporary password**. It is shown to the admin **once** to hand over in person, and is never stored in plain text, emailed or logged.
4. The account is set to `must_change_password=True`. **All of the user's sessions are revoked.**
5. At the next login, the user must set a new password that passes the validators. The temporary password expires after 24 hours.
6. An audit entry records the actor, target, reason, IP and time. The user's email, if set, gets a "your password was reset by …" notice.

**Rules:** resetting another **admin's** password requires the reset to come from a higher tier. National admins can't reset each other's passwords without a second national admin approving.

### 5.5 How much of the database each unit holds

PostgreSQL measures storage per table, not per tenant, so a per-station size is an **estimate**. It's still accurate enough for capacity planning and spotting anomalies. Method:

- A nightly management command, `compute_org_usage`, runs from the existing 02:30 cron slot after the backup.
- For each model with `owner_org_unit`, it records the row count per unit (`GROUP BY owner_org_unit_id`, using indexes). It estimates bytes as `row_count × (table size including indexes ÷ total rows)`.
- **Media bytes** are summed per unit from the file fields.
- Results are written to `org_usage_snapshot`. The dashboard reads snapshots, so **the live database is never scanned on page load**, and growth trends come for free.
- Each figure is shown as a **share of the parent** (station % of province, province % of national) and as absolute numbers per module.

### 5.6 Tamper-evident audit

Each audit row stores `hash = SHA-256(prev_hash ‖ canonical row)`. A nightly check walks the chain. Any edit or deletion, even by someone with database access who bypasses the trigger, breaks the chain and raises a national alert. Exports include the hash so they can be verified independently.

---

## 6. Additional security controls

| Control | Detail |
|---|---|
| **MFA (TOTP)** | Mandatory for all admin tiers. Optional, and later mandatory, for operational users. Recovery codes are stored hashed. |
| **Login protection** | Lock after 5 failures for 15 minutes, with growing back-off. Per-IP throttling on `/api/auth/login/`. The same generic error for "unknown user" and "wrong password". |
| **Two-person rule** | Creating or removing national admins, changing the role/capability catalogue, deleting or moving provinces and stations, and break-glass access. The first admin requests; a second national admin approves within 24 h. |
| **Django admin** | Restrict `/admin/` in nginx to an allow-list of HQ IP addresses, or disable it in production. |
| **Least privilege** | Admin roles have no operational capabilities by default (§2.4). |
| **Alerting** | Privilege changes, break-glass, failed-login spikes, audit-chain breaks and dormant-account reactivation go to national admins, by email or another channel. |
| **Session hygiene** | 15-minute access tokens, refresh limited to one shift, idle timeout of 30 minutes on admin screens. |

---

## 7. API design (summary)

All endpoints live under `/api/admin/`. Every one is scoped by `admin_scope()` and checked with `can()`.

```text
GET    /org-units/tree/                     scoped hierarchy with counts
POST   /org-units/                          create province (national) / station (provincial)
PATCH  /org-units/{id}/                     rename, deactivate (soft)
GET    /org-units/{id}/usage/?period=30d    footprint from org_usage_snapshot

GET    /users/?org_unit=&role=&status=&q=   directory (paginated, scoped)
POST   /users/                              create from HR officer roster
GET    /users/{id}/                         profile + assignments + password health + sessions
POST   /users/{id}/assignments/             grant (validated by the grant rule)
DELETE /users/{id}/assignments/{aid}/       revoke (reason required)
POST   /users/{id}/reset-credential/        temp credential, revoke sessions (reason required)
POST   /users/{id}/suspend/ | /reactivate/ | /unlock/

GET    /sessions/online/?org_unit=          who is online
DELETE /sessions/{sid}/                     force logout
GET    /activity/?org_unit=&user=&module=&from=&to=   activity stream + CSV export
GET    /login-events/?org_unit=&success=false        failed logins
GET    /alerts/                             security alerts in scope
GET    /grantable-roles/?org_unit=          drives role dropdowns
POST   /approvals/{id}/approve              two-person rule
```

The legacy endpoints (`/api/auth/users/`, `/user-assignments/`, `/roles/`, `/admin-actions/`) are locked down in Phase 0 and retired once the new console ships.

---

## 8. Frontend: Admin Console (React)

One console that adapts to the admin's tier. The server returns `admin_scope` and `capabilities` in `/api/auth/me/`, and the UI renders from those.

| Screen | National | Provincial | Station |
|---|---|---|---|
| **Overview**: online now, logins today, failed logins, alerts, storage share | ✔ national | ✔ province | ✔ station |
| **Organisation tree**: drill NHQ → province → station → users | full tree | own subtree | own station |
| **User directory**: filters, password health, MFA, last seen, bulk actions | ✔ | ✔ | ✔ |
| **User detail**: assignments, sessions, activity, reset/suspend/unlock | ✔ | ✔ | ✔ |
| **Who's online**: live table with force logout | ✔ | ✔ | ✔ |
| **Activity stream**: timeline, before/after diff viewer, CSV export | ✔ | ✔ | ✔ |
| **Data footprint**: share bars, per-module table, 90-day trend | ✔ | ✔ | ✔ |
| **Roles & capabilities** | ✔ (two-person) | view | view |
| **Security policy & alerts** | ✔ | alerts | alerts |
| **Access reviews** | ✔ | ✔ | ✔ |
| **Approvals queue** (two-person rule) | ✔ | n/a | n/a |

Implementation notes:
- **Scope switcher** in the header (for example "Harare Province ▸ Chikurubi") that sets the `org_unit` filter for every screen.
- Role dropdowns are populated **only** from `/grantable-roles/`, so the UI never offers a role the server would reject.
- Destructive actions open a confirmation dialog with a **required reason** field.
- The temporary credential appears once, in a copy-once modal that can't be retrieved again.
- The existing pages (`AdminDashboard`, `RoleManagement`, `UserAssignmentManagement`, `AuditTrail`, `DataExposureManagement`, `AdminWizard`) are refactored into the console rather than rewritten.

---

## 9. Delivery plan

Estimates are for one experienced full-stack developer, in working days. They're rough and will move once Phase 1 shows how much legacy data needs migrating.

| Phase | Content | Est. | Ships independently |
|---|---|---|---|
| **0. Security hotfix** | F1 to F6, F10 to F11: lock RBAC viewsets to the right capabilities, enforce the grant rule on every assignment path, require `parent` and scope for stations, scope the audit API, install the token blacklist and revoke on logout, validate admin-set passwords, and add regression tests for each. Check production for past abuse. | 2–3 | **Yes. Do this now.** |
| **1. Role and scope foundation** | Role tiers, `RoleCapability` table, a single `can()` engine, grant matrix, data migration to `OrgUnit`/`UserAssignment`, F7 to F9 fixes. | 6–8 | Yes |
| **2. Identity and sessions** | `auth_user_session`, `sid` claim, heartbeat, online view, force logout, 15-minute tokens, lockout, login events, password health, reset flow, dormant-account job, HR-driven offboarding. | 6–8 | Yes |
| **3. Audit 2.0** | `org_unit` FK, real actor role, before/after diffs, sensitive-read logging, append-only trigger, hash chain and nightly verification, scoped activity API and export. | 4–5 | Yes |
| **4. Usage metering** | `org_usage_snapshot`, nightly job, footprint API. | 2–3 | Yes |
| **5. Admin console UI** | All screens in §8, built on Phases 1 to 4. | 10–12 | Yes, screen by screen |
| **6. Governance** | MFA, two-person approvals, access recertification, alerts, break-glass, `/admin/` IP restriction. | 6–8 | Yes |

**Total: about 36–47 working days.** Phase 0 is independent and should ship before anything else.

### Testing strategy

- **Permission matrix tests.** A table-driven test runs every admin endpoint against every combination of actor tier and target scope (own unit, child, sibling, parent, other province) and asserts allow or deny. The F1 privilege escalation would have failed this test.
- **Escalation regression tests** for each finding F1 to F11.
- **Migration rehearsal** on a restored copy of the production backup before Phase 1 runs live.
- The deploy pipeline's candidate checks and smoke tests stay in place. Phase 0 adds a smoke check that an unprivileged token gets `403` from `/api/auth/roles/` (POST).

---

## 10. Decisions needed from the organisation

1. **Separation of duties (§2.4):** may system admins read operational data (inmates, health), or only manage accounts? The recommendation is accounts only, with break-glass.
2. **MFA delivery:** TOTP app (recommended; no per-message cost) or SMS?
3. **Retention:** how long must audit and login records be kept? Legal or regulatory requirements apply here.
4. **Dormancy threshold:** 60 days proposed.
5. **Who holds the two break-glass superuser accounts**, and where their credentials are stored (sealed envelope or password manager).
