# Phase 1 — On‑Site Administrator Runbook

This runbook describes step‑by‑step actions for setting up the Prison Management System (Phase 1) at Station, Provincial HQ, and National HQ levels. It assumes the codebase in this repository and that the `setup_org_hierarchy` management command has been run or will be run as part of provisioning.

## Quick start (one‑line)

Activate the virtualenv, ensure DB is reachable, then run the setup and seed commands:

```bash
source env/bin/activate
# Create org hierarchy, backfill ownership, create basic users
python manage.py setup_org_hierarchy --full-setup
python manage.py seed_phase1
python manage.py check
```

---

## 1. Overview of the organizational model
- `OrgUnit` — hierarchical unit (NATIONAL_HQ → PROVINCIAL_HQ → STATION)
- `Department` — business departments (RECEPTION, HEALTH, STORES, FARMS, HUMAN_RESOURCES, ...)
- `Role` — canonical roles (SUPER_ADMIN, ADMIN_OFFICER, HEALTH_OFFICER, ...)
- `UserAssignment` — maps a `User` to (`Role`, `OrgUnit`, optional `Department`) and supports multiple assignments per user
- `DataExposurePolicy` / `DataExposureRecord` — declares cross‑OrgUnit visibility rules and per‑resource grants

All writes should have an owning `OrgUnit` (`owner_org_unit`, `receiving_org_unit`, etc.). The management commands will backfill these fields for legacy data.

---

## 2. Station setup (on‑site admin tasks)

1. Verify infrastructure:
   - Confirm the station server can reach the database and that Django `manage.py check` passes.
2. Create the station OrgUnit (if not already created by central team):
   - In Django admin: `OrgUnit` → Add → set `unit_type=STATION`, `parent` = appropriate Provincial HQ.
3. Create `Station` record (Auth.Station) used by legacy `UserProfile`:
   - Set `code` matching the station code and `active=True`.
4. Create Departments for the station (optional if inherited):
   - `Department` entries are global; ensure `OrgUnitDepartment` maps the department to this OrgUnit.
5. Create user accounts and assignments for staff:
   - Create a Django `User` (username = service number or email)
   - Create `UserProfile` linking `user`→`role` (legacy) and `station` (use local `Station`)
   - Create `UserAssignment(user, role, org_unit=<this station>, department=<DEPARTMENT>, is_primary=True)`
6. Verify local operations:
   - Log in as a newly created user, create a small test resource (e.g., register a patient). Confirm `owner_org_unit` is set to the station and audit logs record the action.

---

## 3. Provincial HQ setup (regional admin tasks)

1. Ensure `OrgUnit` for province exists and `parent` = National HQ.
2. Map departments to the Provincial HQ via `OrgUnitDepartment`.
3. Create `User` accounts for provincial administrators and assign `UserAssignment` entries with `org_unit` set to the province and `department` where applicable.
4. Approvals & audits: provincial admins can create/approve `DataExposurePolicy` entries scoped to province; approving creates ability for provincial users to view child station data where policy allows.

---

## 4. National HQ setup (central admin tasks)

1. Create/verify the `NATIONAL_HQ` `OrgUnit`.
2. Create `SystemConfig` if missing and set `national_hq` to the created unit.
3. Seed global `Role` and `Department` records (the provided seed script does this).
4. Create `SUPER_ADMIN` user assignment and seal the system when ready.
5. Create or approve high‑level `DataExposurePolicy` records (e.g., `NATIONAL_OVERSIGHT`) for cross‑province reporting.

---

## 5. Role assignment and examples

Example roles to create (seeded by `seed_phase1`): `SUPER_ADMIN`, `ADMIN_OFFICER`, `RECEPTION_OFFICER`, `HEALTH_OFFICER`, `STORES_OFFICER`, `FARMS_OFFICER`, `HR_OFFICER`, `AUDITOR`.

How to assign a role for a new staff:
1. Create Django `User` (or ensure officer record exists and link it).
2. Create `UserProfile` (legacy) if you use it for some UI flows.
3. Create a `UserAssignment` record with the chosen `Role`, `OrgUnit` and optional `Department`.
4. Set `is_primary=True` for the assignment that should determine request context.

Access expectations (examples):
- `RECEPTION_OFFICER` at a station: create/read inmates and related local records for that station only.
- `HEALTH_OFFICER` at a station: manage patient registers for station inmates and staff.
- `ADMIN_OFFICER` at provincial level: manage `UserAssignment` and approve exposures within the province.

---

## 6. Data exposure policy workflow

1. Create `DataExposurePolicy` (draft) describing source, target, module, and visibility (`READ`, `WRITE`, `FULL`).
2. Review and approve (set `status='APPROVED'` and `approved_by`).
3. To allow access for a specific resource instance, create `DataExposureRecord(resource_type, resource_id, policy, target_org_unit, exposed_by)`.
4. To revoke, set `revoked_at` and `revoked_by` on the `DataExposureRecord`.
5. `AccessScopeMiddleware` and `OrgUnitAccessFilterBackend` use policies and records to compute `request.visible_org_units` and enforce query filtering.

---

## 7. Admin UI setup tips

- Give station admins access to `User`/`UserProfile`/`UserAssignment` for their station only.
- Reserve `OrgUnit` and `SystemConfig` editing for `SUPER_ADMIN`.
- Use `OrgUnitDepartment` inlines to create department mailboxes and routing for the OrgUnit.

---

## 8. Troubleshooting & checks

- If `owner_org_unit` is not set on new records: verify middleware is enabled and the serializer / view `perform_create` sets the org field.
- If cross‑OrgUnit visibility seems wrong: inspect `DataExposurePolicy` and `DataExposureRecord` entries and confirm `status='APPROVED'`.
- Use `python manage.py check` to validate Django settings and app health.

---

## 9. Contact & escalation
- For DB/connectivity issues, contact central infra and confirm PostgreSQL parameters and `default_transaction_isolation`.
- For application bugs, gather logs from `logs/django.log` and `logs/audit.log` and open a ticket with the development team.

---

This runbook is printable and intended for on‑site administrators. For automation, run the `seed_phase1` management command to create the canonical Roles and Departments and example accounts.
