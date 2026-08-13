# Prison Management System (PMS)

![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen)
![Django](https://img.shields.io/badge/Django-5.2+-092E20?logo=django)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)

A comprehensive, full-stack Prison Management System engineered to handle the complexities of inmate lifecycle management, facility operations, and institutional compliance. Built with a robust Django REST API backend and a modern React/Vite frontend, the system is designed around a multi-tenant, hierarchical organizational model (National → Provincial → Station) to ensure strict data isolation and Role-Based Access Control (RBAC).

---

## ✨ Key Features

- **Inmate Lifecycle & Reception**: Full intake processing, health assessments, biometric tracking, and automated asset/property management.
- **Advanced Sentence Computation Engine**: Features a true calendar-based mathematical engine using exact `dateutil` arithmetic to accurately handle leap years, differing month lengths, and concurrent/consecutive sentence aggregations for Ordinary Date of Release (ODR) and Earliest Date of Release (EDR).
- **Hierarchical Data Isolation**: Strict organizational scoping ensures users only access data relevant to their specific station, province, or national headquarters.
- **Role-Based Access Control (RBAC)**: Granular permissions for reception officers, health officials, and administrators.
- **Comprehensive Domain Apps**: Modules for Health, HR, Stores, Farms, Messaging, and Legal Cases.
- **Audit Logging**: Immutable tracking of sensitive actions and registration events.

---

## 🛠 Technology Stack

### Backend
- **Core Framework**: Django 5.2.11 + Django REST Framework (DRF)
- **Database**: PostgreSQL (via `psycopg2`) with optimized connection pooling
- **Authentication**: JWT (`djangorestframework_simplejwt`)
- **API Documentation**: OpenAPI / Swagger (`drf-yasg`)
- **Date Math Engine**: `python-dateutil` for strict calendar compliance

### Frontend
- **Core Framework**: React + TypeScript powered by Vite
- **Styling**: TailwindCSS
- **Components**: Radix UI
- **State/Data Fetching**: TanStack React Query

---

## 📁 Project Structure

```text
Prison_Management_System/
├── Core/               # Django project core (settings, middleware, RBAC filters)
├── Auth/               # Authentication, User Models, and Permissions
├── Reception/          # Inmate intake, sentence math, and release management
├── Health/             # Medical assessments and facility health tracking
├── HumanResources/     # Staff management and deployment
├── Frontend/           # Vite + React + TS Frontend application
├── scripts/            # Deployment and maintenance scripts
├── tests/              # Additional test harnesses
└── docs/               # Architecture and design documentation
```

---

## 🚀 Getting Started

Follow these steps to set up the system for local development.

### 1. Backend Setup (Django API)

Ensure you have **Python 3.10+** installed.

```bash
# Clone the repository
git clone https://github.com/Mcdtronix/Prison_Management_System.git
cd Prison_Management_System

# Create and activate a virtual environment
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure Environment Variables
cp .env.example .env
# Edit .env to configure DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, etc.

# Run migrations and start the development server
python manage.py migrate
python manage.py createsuperuser  # Create an admin account
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend Setup (Vite/React)

Ensure you have **Node.js 18+** installed.

```bash
# Navigate to the frontend directory
cd Frontend

# Install dependencies
npm ci

# Start the Vite development server
npm run dev
```

The frontend will typically run on `http://localhost:5173` and automatically proxy/connect to your local Django API.

---

## 🔒 Security & Compliance
This project enforces strict data governance:
- **Audit Trails**: Critical state changes are logged via the custom `AuditLogging` middleware.
- **Database Architecture**: Refer to `DATABASE_SCHEMA_DESIGN_PHASE_1.md` and `POSTGRESQL_SETUP_GUIDE.md` for production indexing and migration protocols.
- **Security Audits**: See `PHASE_0_SECURITY_AUDIT_REPORT.md` for ongoing security milestones and resolved vulnerabilities.

---

## 📄 License
*Proprietary / Closed Source* - Refer to the internal organization policies for usage and distribution rights.
