# RBAC Capability Matrix

This file lists canonical capability strings used across the system and example roles that grant them.

Format: `module.action` — e.g., `cases.create`, `reception.view`.

Capabilities:

- cases.create, cases.view, cases.change, cases.delete, cases.manage_exposure
- reception.create, reception.view, reception.change, reception.delete
- health.create, health.view, health.change, health.delete
- stores.create, stores.view, stores.change, stores.delete
- farms.create, farms.view, farms.change, farms.delete
- hr.create, hr.view, hr.change, hr.delete
- users.create, users.view, users.change, users.delete
- assignments.manage
- policies.create, policies.view, policies.approve, policies.revoke
- reports.export

Role examples (from `Auth/rbac.py`):
- SUPER_ADMIN: `*` (all capabilities)
- ADMIN_OFFICER: administrative capabilities across cases, users, policies
- RECEPTION_OFFICER: intake and case creation
- HEALTH_OFFICER: health records and case viewing
- STORES_OFFICER: inventory and case linking
- FARMS_OFFICER: farm records
- HR_OFFICER: HR management and assignments
- AUDITOR: read-only access and reports export

Use this matrix when adding new permission checks and when mapping UI actions to capability checks.
