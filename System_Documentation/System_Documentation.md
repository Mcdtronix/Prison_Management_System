# Prison Management System: Comprehensive System Documentation

**Version:** 1.0  
**Date:** August 2026  
**Purpose:** This document serves as the central system documentation for the Prison Management System (PMS), intended for developers, architects, and stakeholders who will maintain, continue, and develop the system, as well as write new features.

---

## 1. System Architecture & History

The Prison Management System (PMS) was built from the ground up to solve complex hierarchical organizational challenges within a national prison service. The core architectural philosophy is based on a **3-tier organizational model** with strict data isolation, ensuring security, compliance, and scalability.

### 1.1 Organizational Structure
The system operates under a 3-tier hierarchical organizational structure:
1. **National Headquarters (1)**: Responsible for system governance, policy definition, and audit oversight.
2. **Provincial Command Centers (10)**: Responsible for regional operations, station oversight, and provincial-level services.
3. **Stations/Prisons (~120-200)**: Responsible for daily operations, inmate/officer management, and local services.

### 1.2 How It Was Built
The development history followed a phased approach:
- **Phase 0 (Foundation)**: Focus on requirement specification, security audits, database schema design, and establishing the foundational architecture. This phase included transitioning to PostgreSQL, establishing a comprehensive role-based access control (RBAC) system, and designing a multi-tenant identity model for users.
- **Phase 1 & Beyond**: Focus on implementing the hierarchical models, multi-assignment RBAC, data exposure models, and migrating existing domain models to enforce data isolation (e.g., adding `owner_org_unit` to all root records).

The architecture separates the frontend client from the backend API, enabling a scalable, stateless backend and a highly interactive user experience.

---

## 2. Features and Modules

The system is highly modular, with specific features mapped to organizational departments. Below is an exhaustive list of features and how they were developed.

### 2.1 Backend Features (Django + Django Rest Framework)

The backend is developed using Python and the Django Web Framework (v5.2) with Django Rest Framework (DRF) for the API layer. Dependencies include `psycopg2-binary` (PostgreSQL adapter), `djangorestframework_simplejwt` (JWT authentication), and `drf-yasg` (Swagger documentation).

* **Auth Module (Authentication & RBAC):**
  * **Development:** Handles user authentication using JSON Web Tokens (JWT). Developed the `OrgUnit`, `Department`, and `UserAssignment` models to facilitate multi-tenant identities.
  * **Functionality:** 3-tier admin authorization (National Admin, Provincial Admin, Station Admin). Users are assigned roles (e.g., `RECEPTION_OFFICER`, `HEALTH_OFFICER`) scoped to specific organizational units and departments.
* **Reception / Admissions Module:**
  * **Development:** Built to manage the lifecycle of an inmate. Core models include `Inmate`, capturing biometric and personal details.
  * **Functionality:** Inmate registration workflows, capturing personal details, assigning unique identifiers, managing admissions and court outcomes.
* **Cases Module:**
  * **Development:** Developed to track legal proceedings and court outcomes for inmates.
  * **Functionality:** Recording court appearances, convictions, sentences, and legal statuses linked to the Reception module.
* **Health / Medical Services Module:**
  * **Development:** Developed with patient data isolation in mind. The `Patient` model links to `Inmate`, and tracks health visits and medical conditions.
  * **Functionality:** Health assessments upon admission, tracking ongoing medical visits, managing clinical records at the station level.
* **Human Resources (HR) Module:**
  * **Development:** Built to manage staff (Officers). Introduced the `OfficerPosting` model to track officer assignments across different organizational units over time.
  * **Functionality:** Officer registration, postings management, qualification tracking, and assigning departmental affiliations.
* **Stores / Logistics Module:**
  * **Development:** Developed to track inventory and supply chain operations. Implemented `StockReceipt` and `FeedingSession` models.
  * **Functionality:** Managing inventory across stations, recording stock receipts, managing feeding sessions for inmates, and equipment allocation.
* **Farms / Production Module:**
  * **Development:** Developed to track agricultural projects within the prison system. Uses `FarmProject` model linked to the owning organizational unit.
  * **Functionality:** Managing crop and livestock production, tracking yields, and managing station-owned farm resources.
* **Messaging Module:**
  * **Development:** Built to facilitate inter-organizational communication. Relies on `OrgUnitDepartment` to provide mailbox identities (e.g., `Reception@Chivhu.pms`).
  * **Functionality:** Secure messaging between stations, provinces, and national headquarters.
* **Core & Governance:**
  * **Development:** Developed `SystemConfig` for system initialization. Developed `DataExposurePolicy` and `DataExposureRecord` to manage controlled upward visibility of data (e.g., exposing station data to provincial HQ).

### 2.2 Frontend Features (React + Vite + TypeScript)

The frontend is a Single Page Application (SPA) developed using React (v18), Vite for fast building, and TypeScript for type safety. It relies on TailwindCSS and Shadcn UI for a modern, accessible, and responsive design system.

* **Dependencies:** `react-router-dom` for routing, `@tanstack/react-query` for API data fetching and state management, `react-hook-form` and `zod` for robust form validation.
* **Dynamic Dashboards:** Developed customized dashboards tailored to user roles and organizational tiers. National admins see aggregated data, while station admins see operational metrics.
* **Inmate Registration Flow:** Developed complex, multi-step forms (e.g., `OffenceRegistrationForm.tsx`, `RecordCourtOutcome.tsx`) using `react-hook-form`. Forms are highly interactive with validation schemas powered by `zod`.
* **RBAC Enforcement on UI:** The UI dynamically adapts based on the user's active `UserAssignment`, hiding or showing navigation items and action buttons depending on permissions and scopes.
* **Data Visualization:** Uses components like `recharts` to render statistical summaries (especially for Provincial and National levels).
* **Modern UI Components:** Heavy use of Radix UI primitives (via Shadcn) for accessible modals (Dialog), Select menus, Data Tables, and Toast notifications (via `sonner`).

---

## 3. Database Architecture & Design

The backend uses **PostgreSQL**, a powerful open-source object-relational database system, chosen specifically for its robustness and full compliance with ACID properties.

### 3.1 ACID Properties (How it Works in PMS)
* **Atomicity:** Ensures that all database operations within a transaction are treated as a single unit. For instance, when an inmate is registered (which creates an `Inmate` record and a base `Health` record), either both records are saved, or neither are.
* **Consistency:** PostgreSQL enforces schema rules, foreign keys, and constraints. For example, the `valid_hierarchy` Check Constraint ensures that a Station cannot be a parent of a Provincial Command Center.
* **Isolation:** Ensures concurrent transactions do not interfere. If two station admins try to assign the same bed to different inmates simultaneously, PostgreSQL's row-level locking ensures only one succeeds, preventing data corruption.
* **Durability:** Once a transaction (e.g., a court outcome update) is committed, it is permanently saved in PostgreSQL, even in the event of a system crash, utilizing Write-Ahead Logging (WAL).

### 3.2 Core Database Entities & Relationships
* **OrgUnit (`auth_org_unit`):** Self-referential entity representing the hierarchy (`NATIONAL_HQ`, `PROVINCIAL_HQ`, `STATION`). Enforced by self-referential Foreign Keys (`parent_id`).
* **Department (`auth_department`):** Fixed list of departments (Reception, Health, Stores, etc.).
* **OrgUnitDepartment:** Resolves the Many-to-Many relationship between OrgUnits and Departments, establishing mailbox addresses.
* **UserAssignment (`auth_user_assignment`):** Binds a `User` to an `OrgUnit`, `Department`, and `Role`. A user can have multiple assignments but only one active primary assignment at a time.
* **Domain Ownership:** All domain entities (e.g., `Inmate`, `Patient`, `StockReceipt`) possess an `owner_org_unit` Foreign Key. This establishes strict data isolation: a user can only query records where `owner_org_unit` matches their active `UserAssignment.org_unit`.
* **DataExposurePolicy (`auth_data_exposure_policy`):** Explicitly defines rules allowing upward visibility of data. For instance, a policy can grant `PROVINCIAL_HQ` read-only access to `STATION` inmate records. 

### 3.3 Security & Audit Trail
* **Encryption at Rest & Transit:** PostgreSQL provides robust security mechanisms. Passwords use bcrypt hashing.
* **Auditability:** Every significant model includes `created_by`, `created_at`, `updated_at`, and often `revoked_by`/`revoked_at` fields to maintain an immutable audit trail of actions. Data exposures require approval workflows stored in the database.

---

## 4. Environment and Deployment Strategy

* **Local Development:** Developers use `python manage.py runserver` for the backend and `npm run dev` (Vite) for the frontend. A local PostgreSQL database is standard.
* **Environment Variables:** Configuration is heavily decoupled using a `.env` file (managed via `python-decouple`), ensuring secrets (database credentials, JWT keys, API keys) are not hardcoded.
* **System Config Initialization:** Before operational use, a setup wizard transitions the database state through `UNINITIALIZED` -> `IN_PROGRESS` -> `READY`, creating the National HQ and provisioning the initial Super Admin.
