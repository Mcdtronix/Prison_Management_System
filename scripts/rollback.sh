#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Emergency rollback script
# Reverts to the last known good Git commit and restores DB
# ─────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/pms"
BACKUP_DIR="/var/backups/pms"
SERVICE_NAME="pms"

echo "🚨 INITIATING ROLLBACK..."

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

# Step 1 — Revert to previous Git commit
cd "$APP_DIR"
CURRENT_COMMIT=$(git rev-parse HEAD)
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)

echo "   Current commit:  $CURRENT_COMMIT"
echo "   Rolling back to: $PREVIOUS_COMMIT"

git reset --hard "$PREVIOUS_COMMIT"

# Step 2 — Restore the most recent pre-deploy backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/pms_pre_deploy_*.sql.gz 2>/dev/null | head -1)

if [ -n "$LATEST_BACKUP" ]; then
    echo "📦 Restoring database from: $LATEST_BACKUP"
    gunzip -c "$LATEST_BACKUP" | PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" "$DB_NAME"
    echo "✅ Database restored"
else
    echo "⚠️  No backup found — skipping database restore"
fi

# Step 3 — Reinstall previous dependencies
source "$APP_DIR/venv/bin/activate"
pip install -r requirements.txt --quiet
deactivate

# Step 4 — Restart service
sudo systemctl restart "$SERVICE_NAME"
sleep 5

# Step 5 — Verify health
if curl -sf https://pms.mcdtronix.co.zw/api/ping/ > /dev/null; then
    echo "✅ ROLLBACK SUCCESSFUL — Application is healthy"
else
    echo "❌ ROLLBACK FAILED — Manual intervention required"
    exit 1
fi
