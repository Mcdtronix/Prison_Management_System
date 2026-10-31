#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PMS zero-guesswork deploy
#
#   deploy.sh --archive <release.tar.gz> --sha <git-sha>
#
# Phases (each one gates the next):
#   1. Preflight   lock, config, PostgreSQL, disk, current health
#   2. Backup      verified pg_dump of production + record previous release
#   3. Stage       unpack into releases/<id>, link shared config/media/logs
#   4. Build       isolated virtualenv, Django deploy checks, collectstatic
#   5. Migrate     apply database migrations (only step that touches prod data)
#   6. Candidate   boot the NEW release on 127.0.0.1 and test it while the
#                  OLD release keeps serving users
#   7. Switch      atomic symlink flip + restart, then socket + public checks
#   8. Finalize    record state, prune old releases
#
# Any failure from phase 3 on triggers automatic rollback:
#   - traffic is pointed back at the previous release
#   - if migrations were applied, the database is restored from the phase-2
#     backup (a safety dump of the failed state is taken first)
#   - the previous release is health-checked
# The script exits non-zero so CI marks the deployment as failed.
# ══════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
umask 027

# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

ARCHIVE=""
SHA=""
CANDIDATE_PORT="${PMS_CANDIDATE_PORT:-8099}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --archive) ARCHIVE="$2"; shift 2 ;;
        --sha)     SHA="$2"; shift 2 ;;
        -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
        *)         die "Unknown argument: $1" ;;
    esac
done
[[ -f "$ARCHIVE" ]] || die "Release archive not found: ${ARCHIVE:-<missing --archive>}"
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || die "Invalid --sha: ${SHA:-<missing>}"

SHORT_SHA="${SHA:0:7}"
RELEASE_ID="$(date '+%Y%m%d%H%M%S')_${SHORT_SHA}"
NEW_RELEASE="$RELEASES_DIR/$RELEASE_ID"

# Rollback bookkeeping
PHASE="init"
PREVIOUS_RELEASE=""
BACKUP_FILE=""
MIGRATIONS_PENDING=0
MIGRATE_STARTED=0
SWITCHED=0
CANDIDATE_PID=""
ROLLING_BACK=0
DEPLOY_DONE=0

mkdir -p "$SHARED_DIR/logs"
DEPLOY_LOG="$SHARED_DIR/logs/deploy_${RELEASE_ID}.log"
exec 2> >(tee -a "$DEPLOY_LOG" >&2)

manage() { "$NEW_RELEASE/venv/bin/python" "$NEW_RELEASE/manage.py" "$@"; }

stop_candidate() {
    if [[ -n "$CANDIDATE_PID" ]] && kill -0 "$CANDIDATE_PID" 2>/dev/null; then
        kill -TERM "$CANDIDATE_PID" 2>/dev/null || true
        wait "$CANDIDATE_PID" 2>/dev/null || true
    fi
    CANDIDATE_PID=""
}

# ── Automatic rollback ───────────────────────────────────────────────
rollback() {
    local reason="$1"
    trap - ERR
    set +e
    ROLLING_BACK=1

    step "ROLLBACK (failed during: $PHASE)"
    err "$reason"
    stop_candidate

    local need_db_restore=0
    if (( MIGRATE_STARTED && MIGRATIONS_PENDING )); then
        need_db_restore=1
    fi

    if (( need_db_restore )) && [[ -n "$PREVIOUS_RELEASE" ]]; then
        # Old code must not run against a half-migrated schema.
        svc stop
    fi

    if (( SWITCHED )) && [[ -n "$PREVIOUS_RELEASE" ]]; then
        switch_current_to "$PREVIOUS_RELEASE"
    fi

    if (( need_db_restore )); then
        info "Migrations were applied, so restoring the pre-deploy database"
        if "$APP_ROOT/bin/backup.sh" --label pre-rollback --release "$SHORT_SHA" >/dev/null; then
            ok "Safety snapshot of the failed state taken"
        else
            warn "Could not snapshot failed state; continuing with restore"
        fi
        if ! restore_database_from "$BACKUP_FILE"; then
            err "DATABASE RESTORE FAILED. Manual intervention required."
            err "Backup to restore: $BACKUP_FILE"
            record_history "ROLLBACK_FAILED sha=$SHORT_SHA release=$RELEASE_ID reason=db-restore"
            exit 2
        fi
    fi

    if [[ -n "$PREVIOUS_RELEASE" ]]; then
        if (( SWITCHED || need_db_restore )); then
            svc restart
        fi
        if wait_until 20 2 check_app_socket; then
            ok "Previous release $(basename "$PREVIOUS_RELEASE") is serving and healthy"
        else
            err "Previous release is NOT healthy after rollback. Manual intervention required."
            record_history "ROLLBACK_UNHEALTHY sha=$SHORT_SHA release=$RELEASE_ID"
            exit 2
        fi
    else
        warn "First deployment: there is no previous release to return to."
    fi

    if [[ -d "$NEW_RELEASE" ]]; then
        mv -f "$NEW_RELEASE" "$NEW_RELEASE.failed" 2>/dev/null || true
    fi
    record_history "ROLLED_BACK sha=$SHORT_SHA release=$RELEASE_ID phase=$PHASE"
    err "Deployment of $SHORT_SHA FAILED and was rolled back. Log: $DEPLOY_LOG"
    exit 1
}

# shellcheck disable=SC2317,SC2329  # invoked via trap
on_error() {
    local code=$? line=$1
    if [[ "$PHASE" == "preflight" || "$PHASE" == "backup" ]]; then
        trap - ERR
        err "Aborted during $PHASE (line $line, exit $code). Production was not touched."
        record_history "ABORTED sha=$SHORT_SHA phase=$PHASE"
        exit 1
    fi
    rollback "Command failed at line $line (exit $code)"
}
# Safety net: any exit after production was touched that is not a clean
# finish or an explicit rollback (e.g. `die` inside a helper) rolls back.
# shellcheck disable=SC2317,SC2329  # invoked via trap
on_exit() {
    local code=$?
    stop_candidate
    if (( code != 0 && ! DEPLOY_DONE && ! ROLLING_BACK )); then
        case "$PHASE" in
            stage|build|migrate|candidate|switch)
                rollback "Deploy exited unexpectedly (exit $code)" ;;
        esac
    fi
}
trap 'on_error $LINENO' ERR
trap on_exit EXIT

step "PMS deploy $SHORT_SHA -> $RELEASE_ID"

# ═════════════════════════════ 1. PREFLIGHT ═════════════════════════
PHASE="preflight"
step "1/8 Preflight"
require_cmd tar curl flock pg_dump pg_restore psql python3 sha256sum
acquire_lock
load_db_env   # also enforces DB_ENGINE == postgresql
[[ "$(env_get DEBUG)" =~ ^([Ff]alse|0)$ ]] || die "DEBUG must be False in $ENV_FILE"

pg_isready -q -t 10 || die "PostgreSQL is not accepting connections"
psql -X -q -c 'SELECT 1;' >/dev/null || die "Cannot authenticate to PostgreSQL as $PGUSER"
ok "PostgreSQL reachable ($PGUSER@$PGHOST:$PGPORT/$PGDATABASE)"

free_mb="$(df --output=avail -BM "$APP_ROOT" | tail -n 1 | tr -dc '0-9')"
(( free_mb > 1024 )) || die "Less than 1 GiB free on $APP_ROOT (${free_mb} MiB)"
ok "Disk: ${free_mb} MiB free"

PREVIOUS_RELEASE="$(current_release_dir)"
if [[ -n "$PREVIOUS_RELEASE" ]]; then
    info "Live release: $(basename "$PREVIOUS_RELEASE")"
    if check_app_socket; then
        ok "Live release is healthy"
    else
        warn "Live release is currently UNHEALTHY; continuing, as this deploy may be the fix"
    fi
else
    info "No live release: this is the first deployment"
fi

# ═════════════════════════════ 2. BACKUP ════════════════════════════
PHASE="backup"
step "2/8 Backup"
BACKUP_FILE="$("$APP_ROOT/bin/backup.sh" --label pre-deploy --release "$SHORT_SHA")"
[[ -s "$BACKUP_FILE" ]] || die "Backup did not produce an archive"
ok "Restore point: $BACKUP_FILE"
if [[ -n "$PREVIOUS_RELEASE" ]]; then
    ok "Code restore point: $(basename "$PREVIOUS_RELEASE")"
fi

# ═════════════════════════════ 3. STAGE ═════════════════════════════
PHASE="stage"
step "3/8 Stage release"
mkdir -p "$NEW_RELEASE"
tar -xzf "$ARCHIVE" -C "$NEW_RELEASE"
[[ -f "$NEW_RELEASE/manage.py" ]] || rollback "Archive has no manage.py"
[[ -f "$NEW_RELEASE/Frontend/dist/index.html" ]] || rollback "Archive has no frontend build"

ln -sfn "$ENV_FILE"          "$NEW_RELEASE/.env"
rm -rf "${NEW_RELEASE:?}/media" "${NEW_RELEASE:?}/logs"
ln -sfn "$SHARED_DIR/media"  "$NEW_RELEASE/media"
ln -sfn "$SHARED_DIR/logs"   "$NEW_RELEASE/logs"
printf '%s\n' "$SHA" > "$NEW_RELEASE/REVISION"
ok "Staged at $NEW_RELEASE"

# ═════════════════════════════ 4. BUILD ═════════════════════════════
PHASE="build"
step "4/8 Build"
python3 -m venv "$NEW_RELEASE/venv"
"$NEW_RELEASE/venv/bin/pip" install --quiet --upgrade pip wheel
PIP_CACHE_DIR="$SHARED_DIR/.pip-cache" \
    "$NEW_RELEASE/venv/bin/pip" install --quiet --no-input -r "$NEW_RELEASE/requirements.txt"
ok "Dependencies installed"

engine="$(manage shell -c 'from django.conf import settings; print(settings.DATABASES["default"]["ENGINE"])' | tail -n 1)"
[[ "$engine" == "django.db.backends.postgresql" ]] \
    || rollback "Release resolves to database engine '$engine', expected PostgreSQL"
ok "Database engine: PostgreSQL"

manage check --deploy --fail-level ERROR
ok "Django deploy checks passed"

manage collectstatic --noinput --verbosity 0
ok "Static files collected"

# ═════════════════════════════ 5. MIGRATE ═══════════════════════════
PHASE="migrate"
step "5/8 Migrate"
plan="$(manage migrate --plan)"
if grep -q "No planned migration operations" <<<"$plan"; then
    info "No pending migrations"
else
    MIGRATIONS_PENDING=1
    info "Pending migrations:"
    printf '%s\n' "$plan" | sed 's/^/    /' >&2
    MIGRATE_STARTED=1
    manage migrate --noinput
    ok "Migrations applied"
fi

# ═════════════════════════════ 6. CANDIDATE ═════════════════════════
PHASE="candidate"
step "6/8 Test candidate release (users still on previous release)"
if curl -s --max-time 2 "http://127.0.0.1:$CANDIDATE_PORT/" >/dev/null 2>&1; then
    rollback "Candidate port $CANDIDATE_PORT is already in use"
fi

(
    cd "$NEW_RELEASE"
    exec "$NEW_RELEASE/venv/bin/gunicorn" Core.wsgi:application \
        --bind "127.0.0.1:$CANDIDATE_PORT" --workers 2 --timeout 60 \
        --access-logfile - --error-logfile -
) >>"$SHARED_DIR/logs/candidate_${RELEASE_ID}.log" 2>&1 &
CANDIDATE_PID=$!

base="http://127.0.0.1:$CANDIDATE_PORT"
# shellcheck disable=SC2317,SC2329  # invoked via wait_until
candidate_ping() {
    curl -fsS --max-time 5 -H "Host: $DOMAIN" "$base/api/ping/" 2>/dev/null \
        | grep -q '"status": *"healthy"'
}
wait_until 30 1 candidate_ping || rollback "Candidate failed health check (see candidate_${RELEASE_ID}.log)"
ok "Health endpoint: healthy, database connected"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" \
        -H 'Content-Type: application/json' -d '{"username":"__deploy_probe__","password":"x"}' \
        "$base/api/auth/login/")"
[[ "$code" =~ ^(400|401|403)$ ]] || rollback "Login endpoint returned HTTP $code (expected 400/401/403)"
ok "Auth endpoint rejects bad credentials (HTTP $code)"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $DOMAIN" "$base/admin/login/")"
[[ "$code" == "200" ]] || rollback "Admin login page returned HTTP $code"
ok "Admin + static manifest render (HTTP 200)"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -H "Host: $DOMAIN" "$base/swagger.json")"
[[ "$code" == "200" ]] || rollback "API schema returned HTTP $code (a view or serializer is broken)"
ok "API schema builds (every endpoint imported)"

missing=0
while read -r asset; do
    [[ -f "$NEW_RELEASE/Frontend/dist/$asset" ]] || { err "Missing frontend asset: $asset"; missing=1; }
done < <(grep -oE '(src|href)="/assets/[^"]+"' "$NEW_RELEASE/Frontend/dist/index.html" | sed -E 's/^(src|href)="\///; s/"$//')
(( missing == 0 )) || rollback "Frontend build references missing assets"
ok "Frontend bundle complete"

stop_candidate

# ═════════════════════════════ 7. SWITCH ════════════════════════════
PHASE="switch"
step "7/8 Switch traffic"
switch_current_to "$NEW_RELEASE"
SWITCHED=1
svc restart

wait_until 30 2 check_app_socket || rollback "New release failed health check after restart"
ok "Gunicorn healthy on $APP_SOCKET"

wait_until 10 3 check_public || rollback "Public endpoint https://$DOMAIN failed (nginx/TLS/SPA)"
ok "https://$DOMAIN serving API and SPA"

# ═════════════════════════════ 8. FINALIZE ══════════════════════════
PHASE="finalize"
DEPLOY_DONE=1
step "8/8 Finalize"
write_state \
    "CURRENT_RELEASE=$NEW_RELEASE" \
    "PREVIOUS_RELEASE=$PREVIOUS_RELEASE" \
    "SHA=$SHA" \
    "BACKUP_FILE=$BACKUP_FILE" \
    "MIGRATIONS_APPLIED=$MIGRATIONS_PENDING" \
    "DEPLOYED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
record_history "DEPLOYED sha=$SHORT_SHA release=$RELEASE_ID migrations=$MIGRATIONS_PENDING backup=$(basename "$BACKUP_FILE")"

# Keep the newest N releases; never delete live or previous.
trap - ERR
set +e
mapfile -t old < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +"$((KEEP_RELEASES + 1))")
for r in "${old[@]}"; do
    [[ "$RELEASES_DIR/$r" == "$NEW_RELEASE" || "$RELEASES_DIR/$r" == "$PREVIOUS_RELEASE" ]] && continue
    rm -rf "${RELEASES_DIR:?}/$r" && info "Pruned release $r"
done
find "$APP_ROOT/incoming" -type f -mtime +7 -delete 2>/dev/null
find "$SHARED_DIR/logs" -maxdepth 1 -name 'candidate_*.log' -mtime +30 -delete 2>/dev/null
find "$SHARED_DIR/logs" -maxdepth 1 -name 'deploy_*.log' -mtime +90 -delete 2>/dev/null

step "DEPLOYED $SHORT_SHA"
ok "Release:  $RELEASE_ID"
ok "Backup:   $(basename "$BACKUP_FILE")"
ok "Rollback: $(basename "${PREVIOUS_RELEASE:-<none>}")"
exit 0
