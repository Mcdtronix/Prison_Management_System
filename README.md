What this is
A full-stack Prison Management System built as a Django REST API (multi-app Django project) with a Vite + React + TypeScript frontend. It implements domain apps for Admissions, Health, HR, Stores, Farms, Messaging and Cases, with RBAC, audit logging, and an organizational (national → provincial → station) ownership/isolation model aimed at multi-tenant data separation and compliance.

Stack
Language(s): Python (backend) and TypeScript / JavaScript (frontend)
Framework / runtime: Django (project settings reference Django 6.0; requirements.txt pins Django 5.2.11) for the API; Vite + React + TypeScript for the frontend
Notable libraries:
Django REST Framework + drf-yasg (API + OpenAPI/swagger)
djangorestframework_simplejwt (JWT auth)
psycopg2 (Postgres DB driver) and project-tailored DB config / connection pooling
Tailwind + Radix UI + @tanstack/react-query (frontend UI and data fetching)
How it's organized
Code
00_START_HERE_PHASE_0_SUMMARY.md        ← Phase 0 summary & kickoff notes
PHASE_0_*.md (security, checklist, executive summary, DB design, etc) ← governance & design docs
.env.example                            ← environment variable template
requirements.txt                        ← Python dependencies
manage.py                               ← Django management entrypoint
Core/                                    ← Django project settings, middleware, filters, URLs
  settings.py                            ← DB, JWT, logging, middleware (OrgContext, AccessScope, AuditLogging)
  filters.py, mixins.py                  ← DRF helpers and access filters
  middleware/                            ← placeholders for Phase 1 middleware
Auth/                                    ← authentication, RBAC, serializers, views, permissions, admin
Reception/, Health/, HumanResources/, Stores/, Farms/, Messaging/, Cases/
                                         ← domain Django apps (models.py, views.py, serializers.py, urls.py, tests.py)
Frontend/                                ← Vite + React + TypeScript frontend (package.json, tailwind, src/)
cypress/                                 ← end-to-end tests for frontend
docs/                                    ← documentation
templates/                               ← Django templates used by any server-rendered pages
scripts/                                 ← dev / deployment scripts
tests/                                   ← additional test harnesses; many test_*.py at repo root
.github/                                 ← CI/issue templates (repo governance)
misc Python scripts (patch_*.py, fix_*.py, debug_*.py) ← maintenance/debug helpers
How it fits together:

The Django project (Core) wires up REST API endpoints via app-level ViewSets and urls.py in each domain app (e.g., Reception/views.py and Reception/serializers.py). Core.settings.py configures DRF, JWT authentication, an OrgUnit-based access filter (Core.filters.OrgUnitAccessFilterBackend) and phase-1 middleware stubs (OrgContext, AccessScope, AuditLogging). Auth/ contains the user, RBAC, permissions, and JWT-related serializers/views used across the API. The frontend (Frontend/) is a Vite React app that calls the API endpoints (package.json scripts: dev/build/preview) and uses Tailwind + Radix components for UI.
How to run it
Shortest path from clone to a running development instance (backend API + frontend dev server):

Backend (Django)

Create a Python venv and install dependencies:
Ensure Python 3.10+ (match your environment)
Provide env vars (see Core/settings.py and .env.example) and run migrations and server.
Example commands:

Code
git clone https://github.com/Mcdtronix/Prison_Management_System.git
cd Prison_Management_System

# Python environment (example)
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env from .env.example and edit DB / SECRET_KEY values
cp .env.example .env
# edit .env to set DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, DEBUG, ALLOWED_HOSTS, etc.

# Migrate and run
python manage.py migrate
python manage.py createsuperuser   # optional: create admin user
python manage.py runserver 0.0.0.0:8000
Frontend (Vite + React)

Code
cd Frontend
# use npm, yarn or bun depending on your toolchain (package.json exists; bun.lockb and package-lock.json present)
npm ci
npm run dev
# or: npm run build && npm run preview for a production preview
Required / notable env vars (drawn from Core/settings.py and .env.example):

SECRET_KEY
DEBUG
DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_CONN_MAX_AGE
ALLOWED_HOSTS or CORS_ALLOWED_ORIGINS / CORS_ALLOW_ALL_ORIGINS
SENTRY_DSN (optional)
TIMEZONE (defaults to Africa/Harare in settings)
Other runtime settings in .env.example referenced by Core/settings.py (SESSION_COOKIE_*, AUDIT_RETENTION_DAYS, etc.)
Notes:

The project is configured for PostgreSQL in Core/settings.py (psycopg2 in requirements). There are Phase 0 migration/design docs (DATABASE_SCHEMA_DESIGN_PHASE_1.md) and a POSTGRESQL_SETUP_GUIDE.md that document production DB setup and migration steps.
There is a security audit (PHASE_0_SECURITY_AUDIT_REPORT.md); the Phase 0 summary calls out critical findings (object-level permission gaps and missing org-context middleware) that should be resolved before production deployment.
