#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PMS database restore (operator tool)
#
#   restore_db.sh <backup.dump> [--yes]
#   restore_db.sh --list
#
# Restores a pg_dump custom-format archive into the production database.
# Also used for the one-time import of data from the previous server:
#   old server:  pg_dump --format=custom -f pms_import.dump <dbname>
#   new server:  restore_db.sh /path/to/pms_import.dump
#
# Safety: takes a "pre-restore" dump of the current database first, stops
# the app during the restore, and restores in a single transaction.
# ══════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
umask 077

# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

DUMP=""
ASSUME_YES=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --list)
            find "$DB_BACKUP_DIR" -maxdepth 1 -name '*.dump' \
                 -printf '%TY-%Tm-%Td %TH:%TM  %10s  %f\n' | sort -r | head -n 30
            exit 0 ;;
        --yes|-y)  ASSUME_YES=1; shift ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *)         DUMP="$1"; shift ;;
    esac
done
[[ -n "$DUMP" ]] || die "Usage: restore_db.sh <backup.dump> [--yes]   (see --list)"
DUMP="$(readlink -f "$DUMP")"

require_cmd pg_restore psql flock
acquire_lock
load_db_env

pg_restore --list "$DUMP" >/dev/null || die "Not a readable pg_dump custom-format archive: $DUMP"

warn "This REPLACES database '$PGDATABASE' with $(basename "$DUMP")."
if (( ! ASSUME_YES )); then
    read -r -p "Type the database name to confirm: " answer
    [[ "$answer" == "$PGDATABASE" ]] || die "Aborted by operator"
fi

step "Safety backup"
SAFETY="$("$APP_ROOT/bin/backup.sh" --label pre-restore)"
ok "Current state saved: $(basename "$SAFETY")"

step "Restore"
svc stop
if ! restore_database_from "$DUMP"; then
    svc start
    die "Restore failed. Database unchanged. Application restarted."
fi

# Archives from older code may predate the live release's migrations.
if [[ -n "$(current_release_dir)" ]]; then
    info "Applying migrations of the live release on top of the restored data"
    "$CURRENT_LINK/venv/bin/python" "$CURRENT_LINK/manage.py" migrate --noinput
fi
svc start

wait_until 30 2 check_app_socket || die "Application unhealthy after restore. Safety backup: $SAFETY"
record_history "DB_RESTORE from=$(basename "$DUMP") safety=$(basename "$SAFETY")"
ok "Restore complete. Safety backup kept at $SAFETY"
