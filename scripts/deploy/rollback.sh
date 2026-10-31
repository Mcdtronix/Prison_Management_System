#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PMS rollback: return production to a previous release
#
#   rollback.sh [--to <release-id>] [--restore-db auto|yes|no]
#               [--reason "<text>"] [--yes]
#
#   --to          release directory name under releases/ (default: the
#                 release that was live before the last deploy)
#   --restore-db  auto (default): restore the last deploy's pre-deploy
#                   backup only if that deploy applied migrations, since
#                   the old code may not run on the new schema
#                 yes: always restore that backup
#                 no:  code-only rollback, keep current data
#   --yes         non-interactive (CI)
#
# Before any database restore, a "pre-rollback" safety dump of the current
# database is taken, so data written since the deploy can be recovered.
#
# Releases:   ls -1 /var/www/pms/releases
# History:    cat /var/www/pms/shared/state/history.log
# ══════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
umask 027

# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

TARGET=""
RESTORE_DB="auto"
REASON="manual"
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --to)         TARGET="$2"; shift 2 ;;
        --restore-db) RESTORE_DB="$2"; shift 2 ;;
        --reason)     REASON="$2"; shift 2 ;;
        --yes|-y)     ASSUME_YES=1; shift ;;
        -h|--help)    sed -n '2,23p' "$0"; exit 0 ;;
        *)            die "Unknown argument: $1" ;;
    esac
done
[[ "$RESTORE_DB" =~ ^(auto|yes|no)$ ]] || die "--restore-db must be auto, yes or no"

require_cmd curl flock pg_restore psql
acquire_lock
load_db_env

step "PMS rollback"

LIVE="$(current_release_dir)"
[[ -n "$LIVE" ]] || die "No live release found ($CURRENT_LINK)"

if [[ -n "$TARGET" ]]; then
    TARGET_DIR="$RELEASES_DIR/$TARGET"
else
    TARGET_DIR="$(state_get PREVIOUS_RELEASE)"
    [[ -n "$TARGET_DIR" ]] || die "No previous release recorded. Use --to <release-id>. Available: $(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f ')"
fi
TARGET_DIR="$(readlink -f "$TARGET_DIR")"

[[ "$TARGET_DIR" != "$LIVE" ]] || die "$(basename "$TARGET_DIR") is already live"
release_is_runnable "$TARGET_DIR" || die "Release is missing or incomplete: $TARGET_DIR"

# Which backup belongs to the deploy we are undoing?
STATE_RELEASE="$(state_get CURRENT_RELEASE)"
BACKUP_FILE=""
MIGRATIONS_APPLIED=0
if [[ "$(readlink -f "${STATE_RELEASE:-/nonexistent}")" == "$LIVE" ]]; then
    BACKUP_FILE="$(state_get BACKUP_FILE)"
    MIGRATIONS_APPLIED="$(state_get MIGRATIONS_APPLIED)"
fi

DO_RESTORE=0
case "$RESTORE_DB" in
    yes)  DO_RESTORE=1 ;;
    auto) if [[ "$MIGRATIONS_APPLIED" == "1" ]]; then DO_RESTORE=1; fi ;;
esac
if (( DO_RESTORE )) && [[ ! -f "$BACKUP_FILE" ]]; then
    die "Database restore requested but the pre-deploy backup is not available (${BACKUP_FILE:-unknown}). Re-run with --restore-db no, or restore manually with restore_db.sh."
fi

info "Live release:    $(basename "$LIVE")"
info "Roll back to:    $(basename "$TARGET_DIR")"
if (( DO_RESTORE )); then
    info "Database:        restore $(basename "$BACKUP_FILE")"
    warn "Data written since that backup will be replaced (a safety dump is taken first)."
else
    info "Database:        unchanged"
fi
info "Reason:          $REASON"

if (( ! ASSUME_YES )); then
    read -r -p "Proceed? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || die "Aborted by operator"
fi

# ── Execute ──────────────────────────────────────────────────────────
if (( DO_RESTORE )); then
    step "Safety backup of current database"
    SAFETY="$("$APP_ROOT/bin/backup.sh" --label pre-rollback)"
    ok "Safety backup: $(basename "$SAFETY")"

    step "Restore database"
    svc stop
    switch_current_to "$TARGET_DIR"
    if ! restore_database_from "$BACKUP_FILE"; then
        err "Restore failed. The database was left unchanged (single transaction)."
        switch_current_to "$LIVE"
        svc start
        die "Rollback aborted. $(basename "$LIVE") is still live."
    fi
    svc start
else
    step "Switch release"
    switch_current_to "$TARGET_DIR"
    svc restart
fi

step "Verify"
if ! wait_until 30 2 check_app_socket; then
    record_history "ROLLBACK_UNHEALTHY to=$(basename "$TARGET_DIR") from=$(basename "$LIVE")"
    die "Rolled-back release is NOT healthy. Check: journalctl -u $SERVICE_NAME -n 200"
fi
ok "Application healthy"
if wait_until 5 3 check_public; then
    ok "https://$DOMAIN serving"
else
    warn "Public check failed (nginx/TLS); the app itself is healthy"
fi

write_state \
    "CURRENT_RELEASE=$TARGET_DIR" \
    "PREVIOUS_RELEASE=$LIVE" \
    "SHA=$(cat "$TARGET_DIR/REVISION" 2>/dev/null || echo unknown)" \
    "BACKUP_FILE=" \
    "MIGRATIONS_APPLIED=0" \
    "DEPLOYED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
record_history "ROLLBACK to=$(basename "$TARGET_DIR") from=$(basename "$LIVE") db_restored=$DO_RESTORE reason=$REASON"

step "ROLLED BACK to $(basename "$TARGET_DIR")"
