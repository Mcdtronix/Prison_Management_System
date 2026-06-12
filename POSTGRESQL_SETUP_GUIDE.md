# PostgreSQL SETUP GUIDE
## Prison Management System Phase 0 Database Migration

**Version:** 1.0  
**Target:** Production PostgreSQL 12+  
**Duration:** ~30-60 minutes  

---

## 1. PREREQUISITES

### 1.1 System Requirements

- Linux/Mac/Windows with Docker or native PostgreSQL install
- 2GB minimum free disk space
- Network access to database server

### 1.2 Software Requirements

```bash
# PostgreSQL 12+ (via package manager or Docker)
# Django 6.0 with psycopg2 driver
# Python 3.10+
```

### 1.3 Access Requirements

- SSH/RDP access to database server
- DBA or admin privileges (or request from DBA)
- Database user creation permissions

---

## 2. INSTALLATION OPTIONS

### 2.1 Option A: Docker (Recommended for Dev/Staging)

**Install Docker** (if not already installed):
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# macOS (Homebrew)
brew install docker docker-compose

# Run Docker daemon
sudo systemctl start docker  # Linux
# or launch Docker Desktop (macOS/Windows)
```

**Create docker-compose.yml** in project root:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: prison_pms_db
    environment:
      POSTGRES_DB: prison_pms
      POSTGRES_USER: pms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change_me_in_production}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - pms_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pms_user -d prison_pms"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:  # Optional: Web-based GUI
    image: dpage/pgadmin4:latest
    container_name: prison_pms_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - pms_network

volumes:
  postgres_data:

networks:
  pms_network:
```

**Start containers:**
```bash
docker-compose up -d
```

**Verify:**
```bash
docker ps  # Should show postgres and pgadmin running
docker-compose logs postgres  # Check logs
```

---

### 2.2 Option B: Native PostgreSQL Install

#### **Ubuntu/Debian:**

```bash
# Update package manager
sudo apt-get update

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib postgresql-client

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Enable on boot

# Check status
sudo systemctl status postgresql
```

#### **macOS (Homebrew):**

```bash
# Install PostgreSQL
brew install postgresql@15

# Start service
brew services start postgresql@15

# Check status
psql --version
```

#### **Windows:**

1. Download from: https://www.postgresql.org/download/windows/
2. Run installer, accept defaults
3. Remember admin password for `postgres` superuser

---

## 3. DATABASE & USER CREATION

### 3.1 Connect to PostgreSQL

**If using Docker:**
```bash
docker-compose exec postgres psql -U postgres
```

**If native install:**
```bash
sudo -i -u postgres
psql
```

**If Windows/GUI:**
- Open pgAdmin tool installed with PostgreSQL
- Create new database & user through interface

### 3.2 Create Database User & Database

**Via psql CLI:**

```sql
-- Connect as superuser (postgres)
\c postgres

-- Create application user
CREATE USER pms_user WITH PASSWORD 'your_secure_password_here_minimum_32_chars';

-- Set privileges
ALTER ROLE pms_user SET client_encoding TO 'utf8';
ALTER ROLE pms_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE pms_user SET default_transaction_deferrable TO ON;
ALTER ROLE pms_user SET timezone TO 'Africa/Harare';

-- Create database owned by pms_user
CREATE DATABASE prison_pms OWNER pms_user;

-- Grant privileges
GRANT CONNECT ON DATABASE prison_pms TO pms_user;
GRANT CREATE ON DATABASE prison_pms TO pms_user;

-- Exit psql
\q
```

### 3.3 Verify User & Database

```bash
# List users
psql -U postgres -h localhost -c "\du"

# List databases
psql -U postgres -h localhost -c "\l"

# Connect as pms_user to prison_pms
psql -U pms_user -h localhost -d prison_pms
```

**Expected output:**
```
psql (15.x)
Type "help" for help.

prison_pms=>
```

---

## 4. DJANGO CONFIGURATION

### 4.1 Install PostgreSQL Driver

```bash
# Activate Python virtual environment
cd /home/aqi/Documents/Projects/Prison_Management_System
source env/bin/activate

# Install psycopg2 (PostgreSQL adapter)
pip install psycopg2-binary
# or if that fails:
pip install psycopg2

# Verify
python -c "import psycopg2; print(psycopg2.__version__)"
```

### 4.2 Update .env File

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

**Fill in database section:**
```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=prison_pms
DB_USER=pms_user
DB_PASSWORD=your_secure_password_here_minimum_32_chars
DB_HOST=localhost
DB_PORT=5432
DB_CONN_MAX_AGE=600
```

**For Docker users:**
```
DB_HOST=postgres  # Use service name from docker-compose.yml
DB_PORT=5432
```

### 4.3 Verify Django Connection

```bash
python manage.py dbshell
```

**Expected:** PostgreSQL prompt `prison_pms=>`

Exit:
```sql
\q
```

---

## 5. MIGRATE EXISTING DATA (SQLite → PostgreSQL)

### 5.1 Export SQLite Data

```bash
# Dump SQLite to JSON format (preserves relationships)
python manage.py dumpdata > db_backup.json

# Verify dump
wc -l db_backup.json  # Should have many lines
head -50 db_backup.json  # Check format
```

### 5.2 Create PostgreSQL Schema

```bash
# Run all Django migrations on PostgreSQL
python manage.py migrate

# Verify tables created
python manage.py dbshell
\dt  # List tables
\q
```

### 5.3 Load Data

```bash
# Load dumped data into PostgreSQL
python manage.py loaddata db_backup.json

# Verify data integrity
python manage.py shell
```

**In Django shell:**
```python
from Auth.models import User, Role, Station
from Reception.models import Inmate

print("Users:", User.objects.count())
print("Roles:", Role.objects.count())
print("Stations:", Station.objects.count())
print("Inmates:", Inmate.objects.count())

# Should show non-zero counts
exit()
```

---

## 6. INDEXING STRATEGY

### 6.1 Create Indexes for Performance

```bash
python manage.py dbshell
```

**Execute indexing script:**

```sql
-- Auth indexes
CREATE INDEX idx_org_unit_hierarchy ON auth_station (parent_id) WHERE active = true;
CREATE INDEX idx_user_assignment_user_active ON auth_user_assignment (user_id, is_active);
CREATE INDEX idx_exposure_policy_lookup ON auth_data_exposure_policy (source_org_unit_id, target_org_unit_id, module);

-- Reception indexes
CREATE INDEX idx_inmate_station ON reception_inmate (owner_org_unit_id);
CREATE INDEX idx_inmate_admission_date ON reception_inmate (admission_date);

-- Health indexes
CREATE INDEX idx_patient_station ON health_patient (owner_org_unit_id);
CREATE INDEX idx_patient_type ON health_patient (patient_type);

-- Stores indexes
CREATE INDEX idx_stock_receipt_station ON stores_stock_receipt (receiving_org_unit_id);
CREATE INDEX idx_stock_receipt_date ON stores_stock_receipt (received_date);

-- Farms indexes
CREATE INDEX idx_farm_project_station ON farms_farm_project (owner_org_unit_id);

-- HR indexes
CREATE INDEX idx_officer_posting_station ON hr_officer_posting (org_unit_id);

-- Verify indexes
\di  # List all indexes

\q
```

### 6.2 Check Index Performance

```bash
python manage.py shell
```

```python
from django.db import connection
from django.test.utils import override_settings

# Enable query logging
with override_settings(DEBUG=True):
    from Auth.models import UserProfile
    users = UserProfile.objects.filter(station_id=1)  # Should use index
    
# Check query execution
for query in connection.queries:
    print(query['sql'])
    print(f"Time: {query['time']}s\n")

exit()
```

---

## 7. BACKUP & RECOVERY

### 7.1 Automated Backups

**Create backup script:**

```bash
cat > /home/aqi/Documents/Projects/Prison_Management_System/backup_db.sh << 'EOF'
#!/bin/bash
# Database backup script

BACKUP_DIR="/home/aqi/Documents/Projects/Prison_Management_System/backups"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/prison_pms_$BACKUP_DATE.sql"

mkdir -p "$BACKUP_DIR"

# Docker backup
docker-compose exec -T postgres pg_dump -U pms_user prison_pms > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "prison_pms_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

chmod +x backup_db.sh
```

**Schedule with cron (Linux/Mac):**

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/aqi/Documents/Projects/Prison_Management_System/backup_db.sh >> /tmp/pms_backup.log 2>&1
```

### 7.2 Recovery Procedure

**Restore from backup:**

```bash
# List available backups
ls -lh backups/

# Restore (example)
gunzip < backups/prison_pms_20260510_140000.sql.gz | \
  docker-compose exec -T postgres psql -U pms_user prison_pms
# Or for native:
gunzip < backups/prison_pms_20260510_140000.sql.gz | \
  psql -U pms_user -h localhost prison_pms

# Verify
python manage.py shell
>>> from Auth.models import User
>>> print(User.objects.count())
```

---

## 8. CONNECTION POOLING (Production)

### 8.1 PgBouncer Setup (Optional but Recommended for Scale)

**Install:**
```bash
# Ubuntu/Debian
sudo apt-get install pgbouncer

# macOS
brew install pgbouncer
```

**Configure** `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
prison_pms = host=localhost port=5432 user=pms_user password=your_password dbname=prison_pms

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
max_idle_connections = 0

listen_port = 6432
listen_addr = 127.0.0.1
```

**Start pgbouncer:**
```bash
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer
```

**Update Django .env:**
```
DB_HOST=localhost
DB_PORT=6432  # Connect through pgbouncer instead of postgres directly
```

---

## 9. MONITORING & MAINTENANCE

### 9.1 Check Database Health

```bash
python manage.py dbshell
```

```sql
-- Active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size('prison_pms'));

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Slow queries (requires slow query log enabled)
-- SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

\q
```

### 9.2 Maintenance Tasks

```bash
# Analyze query planner
python manage.py dbshell
```

```sql
ANALYZE;
VACUUM;
REINDEX DATABASE prison_pms;
\q
```

---

## 10. TROUBLESHOOTING

### Issue: Connection Refused

```bash
# Check PostgreSQL running
sudo systemctl status postgresql
# or
docker-compose ps

# Verify credentials in .env
cat .env | grep DB_

# Test connection manually
psql -U pms_user -h localhost -d prison_pms
```

### Issue: Permission Denied

```bash
# Verify user privileges
psql -U postgres -h localhost -c "SELECT * FROM pg_user WHERE usename = 'pms_user';"

# Grant missing privileges
psql -U postgres << EOF
GRANT ALL PRIVILEGES ON DATABASE prison_pms TO pms_user;
GRANT USAGE ON SCHEMA public TO pms_user;
GRANT CREATE ON SCHEMA public TO pms_user;
EOF
```

### Issue: Migration Fails

```bash
# Check migration status
python manage.py showmigrations

# Rollback specific app
python manage.py migrate Auth 0001_initial

# Re-run migrations
python manage.py migrate
```

### Issue: Disk Space

```bash
# Check database size
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('prison_pms'));"

# Clean up old backups
find backups/ -name "*.sql.gz" -mtime +30 -delete

# Vacuum & reindex
python manage.py dbshell
VACUUM FULL;
REINDEX DATABASE prison_pms;
\q
```

---

## 11. SECURITY HARDENING

### 11.1 Network Access

**Restrict PostgreSQL to localhost only:**

In PostgreSQL config (`/etc/postgresql/15/main/postgresql.conf`):
```
listen_addresses = 'localhost'
```

**For remote access (use SSH tunnel):**
```bash
ssh -L 5432:localhost:5432 user@database_server
# Then connect: psql -U pms_user -h localhost prison_pms
```

### 11.2 Password Management

**Strong password policy:**
- Minimum 32 characters
- Mix uppercase, lowercase, numbers, symbols
- Rotate every 90 days

**Update password:**
```sql
ALTER USER pms_user WITH PASSWORD 'new_secure_password_here';
```

### 11.3 Role Permissions

**Least privilege model:**
```sql
-- Remove dangerous privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO pms_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO pms_user;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

---

## 12. VERIFICATION CHECKLIST

- [ ] PostgreSQL server running (`sudo systemctl status postgresql`)
- [ ] Database `prison_pms` created
- [ ] User `pms_user` created with strong password
- [ ] Django `dbshell` connects successfully
- [ ] All migrations executed (`python manage.py migrate`)
- [ ] Data loaded from SQLite dump (`python manage.py loaddata`)
- [ ] Test data count verified (users, inmates, etc.)
- [ ] Indexes created for performance
- [ ] Backup script scheduled (cron)
- [ ] Connection pooling configured (if scaling)
- [ ] Monitor alerts enabled (if available)

---

## 13. REFERENCE COMMANDS

```bash
# Connection
psql -U pms_user -h localhost -d prison_pms

# Backup
pg_dump -U pms_user -h localhost prison_pms > backup.sql

# Restore
psql -U pms_user -h localhost -d prison_pms < backup.sql

# Django
python manage.py migrate
python manage.py dumpdata > backup.json
python manage.py loaddata backup.json

# Docker
docker-compose up -d
docker-compose down
docker-compose logs postgres
docker-compose exec postgres psql -U postgres
```

---

**Phase 0 Completion:** Database ready for Phase 1 implementation.

**Next Steps:** Run security audit → implement hierarchy models → begin Phase 1.

