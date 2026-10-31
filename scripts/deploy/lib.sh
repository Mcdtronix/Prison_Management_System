#!/usr/bin/env bash
# shellcheck shell=bash disable=SC2034  # config vars are consumed by sourcing scripts
# ══════════════════════════════════════════════════════════════════════
# PMS deployment toolkit: shared library
# Sourced by deploy.sh, rollback.sh, backup.sh and restore_db.sh.
#
# Server layout
#   /var/www/pms/
#   ├── current -> releases/<id>     atomic symlink to the live release
#   ├── releases/<id>/               immutable releases, each with its own venv
#   ├── shared/
#   │   ├── .env                     production config (chmod 600)
#   │   ├── media/                   uploaded files (persist across releases)
#   │   ├── logs/                    Django + deploy logs
#   │   └── state/                   last_deploy.env, history.log
#   ├── incoming/                    release archives uploaded by CI
#   └── bin/                         this toolkit
#   /var/backups/pms/
#   ├── db/                          pg_dump custom-format archives + .sha256
#   └── media/                       nightly hard-linked media snapshots
# ══════════════════════════════════════════════════════════════════════

# ── Configuration (override via environment) ─────────────────────────
# Consumed by the scripts that source this file.
APP_ROOT="${PMS_APP_ROOT:-/var/www/pms}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
STATE_DIR="$SHARED_DIR/state"
STATE_FILE="$STATE_DIR/last_deploy.env"
HISTORY_FILE="$STATE_DIR/history.log"
ENV_FILE="$SHARED_DIR/.env"
LOCK_FILE="$APP_ROOT/.deploy.lock"

BACKUP_ROOT="${PMS_BACKUP_ROOT:-/var/backups/pms}"
DB_BACKUP_DIR="$BACKUP_ROOT/db"
MEDIA_BACKUP_DIR="$BACKUP_ROOT/media"

SERVICE_NAME="pms"
DOMAIN="${PMS_DOMAIN:-pms.mcdtronix.co.zw}"
APP_SOCKET="${PMS_APP_SOCKET:-/run/pms/gunicorn.sock}"

KEEP_RELEASES="${PMS_KEEP_RELEASES:-5}"
BACKUP_RETENTION_DAYS="${PMS_BACKUP_RETENTION_DAYS:-30}"
BACKUP_KEEP_MIN="${PMS_BACKUP_KEEP_MIN:-10}"
MEDIA_SNAPSHOTS_KEEP="${PMS_MEDIA_SNAPSHOTS_KEEP:-14}"

# ── Logging (stderr, so stdout stays machine-readable) ───────────────
if [[ -t 2 ]]; then
    _C_RED=$'\e[31m'; _C_GRN=$'\e[32m'; _C_YEL=$'\e[33m'; _C_BLU=$'\e[34m'; _C_BLD=$'\e[1m'; _C_RST=$'\e[0m'
else
    _C_RED=""; _C_GRN=""; _C_YEL=""; _C_BLU=""; _C_BLD=""; _C_RST=""
fi

_ts()  { date '+%Y-%m-%d %H:%M:%S'; }
info() { printf '%s %s[INFO]%s %s\n'  "$(_ts)" "$_C_BLU" "$_C_RST" "$*" >&2; }
ok()   { printf '%s %s[ OK ]%s %s\n'  "$(_ts)" "$_C_GRN" "$_C_RST" "$*" >&2; }
warn() { printf '%s %s[WARN]%s %s\n'  "$(_ts)" "$_C_YEL" "$_C_RST" "$*" >&2; }
err()  { printf '%s %s[FAIL]%s %s\n'  "$(_ts)" "$_C_RED" "$_C_RST" "$*" >&2; }
die()  { err "$*"; exit 1; }
step() { printf '\n%s━━ %s ━━%s\n' "$_C_BLD" "$*" "$_C_RST" >&2; }

# ── Environment ───────────────────────────────────────────────────────
# Read a single key from a KEY=VALUE file without executing it.
kv_get() {
    local file="$1" key="$2" line
    [[ -f "$file" ]] || return 0
    line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
    line="${line#*=}"
    line="${line%$'\r'}"
    line="${line#\"}"; line="${line%\"}"
    line="${line#\'}"; line="${line%\'}"
    printf '%s' "$line"
}

env_get() { kv_get "$ENV_FILE" "$1"; }

# Export libpq variables for pg_dump / pg_restore / psql.
load_db_env() {
    [[ -r "$ENV_FILE" ]] || die "Environment file not readable: $ENV_FILE"

    local engine
    engine="$(env_get DB_ENGINE)"
    engine="${engine:-django.db.backends.postgresql}"
    [[ "$engine" == "django.db.backends.postgresql" ]] \
        || die "DB_ENGINE is '$engine'. Production must run on PostgreSQL."

    PGDATABASE="$(env_get DB_NAME)"
    PGUSER="$(env_get DB_USER)"
    PGPASSWORD="$(env_get DB_PASSWORD)"
    PGHOST="$(env_get DB_HOST)"
    PGPORT="$(env_get DB_PORT)"
    PGHOST="${PGHOST:-127.0.0.1}"
    PGPORT="${PGPORT:-5432}"
    PGCONNECT_TIMEOUT=10
    [[ -n "$PGDATABASE" && -n "$PGUSER" ]] || die "DB_NAME and DB_USER must be set in $ENV_FILE"
    export PGDATABASE PGUSER PGPASSWORD PGHOST PGPORT PGCONNECT_TIMEOUT
}

require_cmd() {
    local c
    for c in "$@"; do
        command -v "$c" >/dev/null 2>&1 || die "Required command not found: $c"
    done
}

# ── Locking: one deploy/rollback at a time ───────────────────────────
acquire_lock() {
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        die "Another deployment or rollback is running (lock: $LOCK_FILE)."
    fi
}

# ── Releases ─────────────────────────────────────────────────────────
current_release_dir() {
    if [[ -L "$CURRENT_LINK" ]]; then
        readlink -f "$CURRENT_LINK"
    fi
}

# Atomically repoint `current` (rename(2) of a symlink is atomic).
switch_current_to() {
    local target="$1"
    [[ -d "$target" ]] || die "Release directory does not exist: $target"
    ln -sfn "$target" "$APP_ROOT/.current.next"
    mv -Tf "$APP_ROOT/.current.next" "$CURRENT_LINK"
    ok "current -> $(basename "$target")"
}

release_is_runnable() {
    local dir="$1"
    [[ -x "$dir/venv/bin/gunicorn" && -f "$dir/manage.py" && -f "$dir/Frontend/dist/index.html" ]]
}

# ── Service control (sudo rights limited by /etc/sudoers.d/pms-deploy) ─
svc() { sudo -n /usr/bin/systemctl "$1" "$SERVICE_NAME"; }

# ── Health checks ────────────────────────────────────────────────────
# Django health endpoint straight through the gunicorn socket (bypasses nginx).
check_app_socket() {
    curl -fsS --max-time 10 --unix-socket "$APP_SOCKET" \
         -H "Host: $DOMAIN" "http://localhost/api/ping/" 2>/dev/null \
        | grep -q '"status": *"healthy"'
}

# Full public path: nginx + TLS + gunicorn + PostgreSQL, pinned to this host
# so the check does not depend on external DNS.
check_public() {
    curl -fsS --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" \
         "https://$DOMAIN/api/ping/" 2>/dev/null \
        | grep -q '"status": *"healthy"' || return 1
    curl -fsS --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" \
         "https://$DOMAIN/" 2>/dev/null \
        | grep -q 'id="root"'
}

# wait_until <attempts> <interval-seconds> <command...>
wait_until() {
    local attempts="$1" interval="$2" i
    shift 2
    for ((i = 1; i <= attempts; i++)); do
        if "$@"; then
            return 0
        fi
        sleep "$interval"
    done
    return 1
}

# ── Database ─────────────────────────────────────────────────────────
# Restore a pg_dump custom-format archive, replacing the whole public schema
# in ONE transaction: either the restore fully succeeds or the database is
# left exactly as it was.
#
# Dropping the schema (rather than pg_restore --clean) also removes tables
# created by migrations newer than the backup, so the restored schema
# exactly matches the backup.
#
# Returns non-zero on any failure (never exits), so callers can react.
restore_database_from() {
    local dump="$1"
    if [[ ! -f "$dump" ]]; then
        err "Backup not found: $dump"; return 1
    fi

    if [[ -f "$dump.sha256" ]]; then
        if ! (cd "$(dirname "$dump")" && sha256sum --quiet -c "$(basename "$dump").sha256"); then
            err "Checksum mismatch, refusing to restore: $dump"; return 1
        fi
    fi
    if ! pg_restore --list "$dump" >/dev/null; then
        err "Backup archive is unreadable: $dump"; return 1
    fi

    info "Terminating other sessions on $PGDATABASE"
    psql -X -q -v ON_ERROR_STOP=1 -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = current_database()
            AND usename = current_user
            AND pid <> pg_backend_pid();" >/dev/null \
        || warn "Could not terminate all sessions; restore may wait on locks"

    local recreate_schema="CREATE SCHEMA public;"
    if pg_restore --list "$dump" | grep -qE '[0-9]+; [0-9]+ [0-9]+ SCHEMA - public '; then
        recreate_schema=""   # the archive creates the schema itself
    fi

    info "Restoring $(basename "$dump") into $PGDATABASE (single transaction)"
    if ! {
        printf 'DROP SCHEMA IF EXISTS public CASCADE;\n%s\n' "$recreate_schema"
        pg_restore --no-owner --no-privileges --file=- "$dump"
    } | psql -X -q -v ON_ERROR_STOP=1 --single-transaction >/dev/null; then
        err "Restore failed; transaction rolled back, database unchanged"
        return 1
    fi

    ok "Database restored from $(basename "$dump")"
}

# ── State / audit trail ──────────────────────────────────────────────
write_state() {
    # write_state KEY=VALUE ...   (replaces the state file atomically)
    mkdir -p "$STATE_DIR"
    printf '%s\n' "$@" > "$STATE_FILE.tmp"
    mv -f "$STATE_FILE.tmp" "$STATE_FILE"
}

state_get() { kv_get "$STATE_FILE" "$1"; }

record_history() {
    mkdir -p "$STATE_DIR"
    printf '%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$HISTORY_FILE"
}
