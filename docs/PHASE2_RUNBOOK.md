# Phase 2 — Case Management Runbook (Concise)

This runbook covers deploying and validating Phase 2 Case Management features: `CaseFile`, `IncidentReport`, and `CourtDate`.

Quick steps:

```bash
source env/bin/activate
python manage.py migrate
python manage.py seed_phase1   # ensure Phase1 foundation exists
python manage.py runserver
```

Validation checklist:
- Create a `CaseFile` via Admin or API; confirm `owner_org_unit` is set by middleware.
- File an `IncidentReport` tied to the `CaseFile`.
- Add a `CourtDate` and confirm it appears on the case.

Notes:
- Writes are tenant-scoped via `owner_org_unit`; ensure `OrgContextMiddleware` is enabled.
- RBAC: only assigned users can perform writes within their `OrgUnit`.
