#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PMS backup
#
#   backup.sh [--label pre-deploy|nightly|manual|pre-restore|pre-rollback]
#             [--release <id>] [--with-media]
#
# Database: pg_dump custom format (compressed, restorable table by table),
#           written atomically, verified with pg_restore --list, sha256 sidecar.
# Media:    (--with-media) hard-linked rsync snapshot. Unchanged files cost
#           no extra disk, so daily snapshots stay cheap.
# Retention: archives older than PMS_BACKUP_RETENTION_DAYS are pruned, but
#           the newest PMS_BACKUP_KEEP_MIN per label are always kept.
#
# Logs go to stderr; the path of the database archive is printed to stdout.
# ══════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
umask 077

# shellcheck source=scripts/deploy/lib.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

LABEL="manual"
RELEASE_TAG=""
WITH_MEDIA=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --label)      LABEL="$2"; shift 2 ;;
        --release)    RELEASE_TAG="$2"; shift 2 ;;
        --with-media) WITH_MEDIA=1; shift ;;
        -h|--help)    sed -n '2,18p' "$0"; exit 0 ;;
        *)            die "Unknown argument: $1" ;;
    esac
done
[[ "$LABEL" =~ ^[a-z-]+$ ]] || die "Invalid label: $LABEL"

require_cmd pg_dump pg_restore psql sha256sum
load_db_env
mkdir -p "$DB_BACKUP_DIR"

# ── Pre-flight: database reachable and enough disk ───────────────────
db_bytes="$(psql -X -At -c 'SELECT pg_database_size(current_database());')" \
    || die "Cannot connect to PostgreSQL ($PGUSER@$PGHOST:$PGPORT/$PGDATABASE)"
free_bytes="$(df --output=avail -B1 "$DB_BACKUP_DIR" | tail -n 1 | tr -d ' ')"
if (( free_bytes < db_bytes + 512 * 1024 * 1024 )); then
    die "Insufficient disk for backup: need ~$((db_bytes / 1048576)) MiB + 512 MiB headroom, have $((free_bytes / 1048576)) MiB"
fi

# ── Database dump ────────────────────────────────────────────────────
stamp="$(date '+%Y%m%d_%H%M%S')"
name="pms_${LABEL}_${stamp}${RELEASE_TAG:+_$RELEASE_TAG}.dump"
target="$DB_BACKUP_DIR/$name"

info "Backing up $PGDATABASE ($((db_bytes / 1048576)) MiB) -> $target"
pg_dump --format=custom --compress=6 --file="$target.partial" \
    || { rm -f "$target.partial"; die "pg_dump failed"; }

pg_restore --list "$target.partial" >/dev/null \
    || { rm -f "$target.partial"; die "Backup verification failed (archive unreadable)"; }

mv -f "$target.partial" "$target"
(cd "$DB_BACKUP_DIR" && sha256sum "$name" > "$name.sha256")
ok "Database backup verified: $name ($(du -h "$target" | cut -f1))"

# ── Media snapshot ───────────────────────────────────────────────────
if (( WITH_MEDIA )); then
    require_cmd rsync
    mkdir -p "$MEDIA_BACKUP_DIR"
    latest="$(find "$MEDIA_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -n 1)"
    snap="$MEDIA_BACKUP_DIR/$stamp"
    info "Snapshotting media -> $snap"
    rsync -a --delete ${latest:+--link-dest="$latest"} "$SHARED_DIR/media/" "$snap.partial/"
    mv -f "$snap.partial" "$snap"
    ok "Media snapshot complete ($(du -sh "$snap" | cut -f1) apparent)"

    # keep the newest N snapshots
    find "$MEDIA_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort -r \
        | tail -n +"$((MEDIA_SNAPSHOTS_KEEP + 1))" | xargs -r rm -rf
fi

# ── Retention ────────────────────────────────────────────────────────
mapfile -t archives < <(ls -1t "$DB_BACKUP_DIR"/pms_"${LABEL}"_*.dump 2>/dev/null || true)
pruned=0
for ((i = BACKUP_KEEP_MIN; i < ${#archives[@]}; i++)); do
    f="${archives[$i]}"
    if [[ -n "$(find "$f" -mtime +"$BACKUP_RETENTION_DAYS" -print -quit)" ]]; then
        rm -f "$f" "$f.sha256"
        pruned=$((pruned + 1))
    fi
done
(( pruned > 0 )) && info "Pruned $pruned '$LABEL' backup(s) older than $BACKUP_RETENTION_DAYS days"

printf '%s\n' "$target"
