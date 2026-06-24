#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Database backup script — runs before every migration
# Backups are stored for 7 days then auto-deleted
# ─────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/pms"
BACKUP_DIR="/var/backups/pms"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pms_pre_deploy_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

# Extract variables safely without executing the .env file
if [ -f "$APP_DIR/.env" ]; then
    _get_env() {
        grep -E "^$1=" "$APP_DIR/.env" | head -1 | sed -e "s/^$1=//" -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
    }
    DB_NAME=$(_get_env DB_NAME)
    DB_USER=$(_get_env DB_USER)
    DB_PASSWORD=$(_get_env DB_PASSWORD)
else
    echo "❌ Error: .env file not found at $APP_DIR/.env"
    exit 1
fi

# Fallback to defaults if .env doesn't specify them
DB_NAME=${DB_NAME:-pms_db}
DB_USER=${DB_USER:-pms_user}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "📦 Starting database backup..."
echo "   Database: $DB_NAME"
echo "   Output: $BACKUP_FILE"

# Run backup using localhost and the password from .env, with clean flags for easy restore
PGPASSWORD="$DB_PASSWORD" pg_dump -h 127.0.0.1 -U "$DB_USER" -c --if-exists "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"
echo "   Size: $(du -sh $BACKUP_FILE | cut -f1)"

# Clean up backups older than RETENTION_DAYS
echo "🧹 Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "pms_pre_deploy_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "✅ Cleanup complete"
