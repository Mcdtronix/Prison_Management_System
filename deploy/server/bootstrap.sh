#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# PMS server bootstrap: one-time provisioning of a fresh Ubuntu 24.04 VPS
#
#   sudo LETSENCRYPT_EMAIL=you@example.com \
#        DEPLOY_PUBKEY="ssh-ed25519 AAAA... github-actions-pms" \
#        bash deploy/server/bootstrap.sh
#
# Idempotent: safe to re-run. It never overwrites an existing shared/.env
# or database password.
#
# Prerequisite: DNS A record  pms.mcdtronix.co.zw -> this server's IP
#
# Installs and configures:
#   - PostgreSQL 16 (local, role + database owned by the app)
#   - Python 3.12 toolchain, nginx, certbot (Let's Encrypt, auto-renew)
#   - `pms` system user: runs the app and receives CI deploys over SSH
#   - /var/www/pms release layout, /var/backups/pms
#   - systemd unit, nginx site, least-privilege sudoers
#   - nightly DB + media backups (02:30), UFW firewall
# ══════════════════════════════════════════════════════════════════════
set -Eeuo pipefail

DOMAIN="${DOMAIN:-pms.mcdtronix.co.zw}"
APP_USER="pms"
APP_ROOT="/var/www/pms"
BACKUP_ROOT="/var/backups/pms"
DB_NAME="${DB_NAME:-prison_pms}"
DB_USER="${DB_USER:-pms_user}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-}"

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)"

log()  { printf '\n\e[1;34m==>\e[0m \e[1m%s\e[0m\n' "$*"; }
ok()   { printf '    \e[32m✓\e[0m %s\n' "$*"; }
warn() { printf '    \e[33m!\e[0m %s\n' "$*"; }
die()  { printf '\e[31mERROR:\e[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ -n "$LETSENCRYPT_EMAIL" ]] || die "Set LETSENCRYPT_EMAIL (certificate expiry notices)."
[[ -f "$REPO_DIR/deploy/systemd/pms.service" ]] || die "Run from a checkout of the repository."
ENV_TEMPLATE="$REPO_DIR/deploy/env/production.env.example"
[[ -s "$ENV_TEMPLATE" ]] || die "Missing $ENV_TEMPLATE. Update the checkout (git pull) and re-run."
# shellcheck source=/dev/null
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || warn "Tested on Ubuntu 24.04; detected ${PRETTY_NAME:-unknown}"

# ── Packages ─────────────────────────────────────────────────────────
log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    python3 python3-venv python3-dev build-essential libpq-dev \
    postgresql postgresql-contrib \
    nginx certbot \
    curl rsync ufw unattended-upgrades ca-certificates >/dev/null
systemctl enable --now postgresql nginx >/dev/null
ok "python $(python3 --version | cut -d' ' -f2), $(psql --version | cut -d' ' -f1,3), nginx $(nginx -v 2>&1 | cut -d/ -f2)"

# ── App user ─────────────────────────────────────────────────────────
log "Creating user '$APP_USER'"
if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "$APP_ROOT" --shell /bin/bash \
            --gid www-data "$APP_USER"
    ok "User created (home $APP_ROOT, group www-data)"
else
    ok "User exists"
fi

install -d -m 700 -o "$APP_USER" -g www-data "$APP_ROOT/.ssh"
if [[ -n "$DEPLOY_PUBKEY" ]]; then
    touch "$APP_ROOT/.ssh/authorized_keys"
    grep -qxF "$DEPLOY_PUBKEY" "$APP_ROOT/.ssh/authorized_keys" \
        || printf '%s\n' "$DEPLOY_PUBKEY" >> "$APP_ROOT/.ssh/authorized_keys"
    chown "$APP_USER:www-data" "$APP_ROOT/.ssh/authorized_keys"
    chmod 600 "$APP_ROOT/.ssh/authorized_keys"
    ok "CI deploy key authorized"
else
    warn "DEPLOY_PUBKEY not set: add the GitHub Actions public key to $APP_ROOT/.ssh/authorized_keys"
fi

# ── Directory layout ─────────────────────────────────────────────────
log "Creating directory layout"
install -d -m 750 -o "$APP_USER" -g www-data \
    "$APP_ROOT" "$APP_ROOT/releases" "$APP_ROOT/incoming" "$APP_ROOT/bin" \
    "$APP_ROOT/shared" "$APP_ROOT/shared/media" "$APP_ROOT/shared/logs" "$APP_ROOT/shared/state"
install -d -m 700 -o "$APP_USER" -g www-data \
    "$BACKUP_ROOT" "$BACKUP_ROOT/db" "$BACKUP_ROOT/media"
install -d -m 755 /var/www/letsencrypt
install -m 750 -o "$APP_USER" -g www-data "$REPO_DIR"/scripts/deploy/*.sh "$APP_ROOT/bin/"
ok "$APP_ROOT and $BACKUP_ROOT ready"

# ── PostgreSQL ───────────────────────────────────────────────────────
log "Configuring PostgreSQL"
ENV_FILE="$APP_ROOT/shared/.env"
DB_PASSWORD=""
if [[ -s "$ENV_FILE" ]]; then
    DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
fi
if [[ -n "$DB_PASSWORD" ]]; then
    REUSE_ENV=1
    ok "Reusing credentials from existing $ENV_FILE"
else
    REUSE_ENV=0
    if [[ -e "$ENV_FILE" ]]; then
        mv "$ENV_FILE" "$ENV_FILE.invalid.$(date +%Y%m%d%H%M%S)"
        warn "Existing $ENV_FILE had no DB_PASSWORD; moved aside and regenerating"
    fi
    DB_PASSWORD="$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 40)"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -q -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';"
    ok "Role $DB_USER created"
else
    sudo -u postgres psql -q -c "ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';"
    ok "Role $DB_USER exists (password synced with .env)"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" -E UTF8 -T template0 "$DB_NAME"
    ok "Database $DB_NAME created (owner $DB_USER)"
else
    ok "Database $DB_NAME exists"
fi
# The app role owns the public schema so restores can recreate it.
sudo -u postgres psql -q -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;"

# ── Production .env ──────────────────────────────────────────────────
log "Writing production configuration"
if (( ! REUSE_ENV )); then
    SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
    # Write to a temp file first so a failure never leaves a partial .env.
    sed -e "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" \
        -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" \
        -e "s|^DB_NAME=.*|DB_NAME=$DB_NAME|" \
        -e "s|^DB_USER=.*|DB_USER=$DB_USER|" \
        "$ENV_TEMPLATE" > "$ENV_FILE.tmp"
    grep -q "^DB_PASSWORD=$DB_PASSWORD\$" "$ENV_FILE.tmp" || die "Failed to render $ENV_FILE"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
    ok "Generated $ENV_FILE with fresh SECRET_KEY and DB password"
else
    ok "$ENV_FILE exists, left unchanged"
fi
chown "$APP_USER:www-data" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── systemd ──────────────────────────────────────────────────────────
log "Installing systemd unit"
install -m 644 "$REPO_DIR/deploy/systemd/pms.service" /etc/systemd/system/pms.service
systemctl daemon-reload
systemctl enable pms >/dev/null
ok "pms.service enabled (starts on first deploy)"

# ── sudoers ──────────────────────────────────────────────────────────
log "Installing least-privilege sudo rules"
install -m 440 "$REPO_DIR/deploy/sudoers/pms-deploy" /etc/sudoers.d/pms-deploy.new
visudo -cf /etc/sudoers.d/pms-deploy.new >/dev/null || die "sudoers validation failed"
mv -f /etc/sudoers.d/pms-deploy.new /etc/sudoers.d/pms-deploy
ok "/etc/sudoers.d/pms-deploy"

# ── nginx + TLS ──────────────────────────────────────────────────────
log "Configuring nginx and TLS for $DOMAIN"
rm -f /etc/nginx/sites-enabled/default
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if [[ ! -f "$CERT" ]]; then
    server_ip="$(curl -fsS4 --max-time 5 https://api.ipify.org || true)"
    dns_ip="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
    if [[ -n "$server_ip" && "$dns_ip" != "$server_ip" ]]; then
        die "$DOMAIN resolves to '${dns_ip:-nothing}', this server is $server_ip. Fix the DNS A record, then re-run."
    fi

    # Temporary HTTP-only site to answer the ACME challenge.
    cat > /etc/nginx/sites-available/pms <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 503; }
}
EOF
    ln -sfn /etc/nginx/sites-available/pms /etc/nginx/sites-enabled/pms
    nginx -t -q && systemctl reload nginx

    certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" \
        --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive --quiet
    ok "Certificate issued"
else
    ok "Certificate present"
fi

install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

install -m 644 "$REPO_DIR/deploy/nginx/pms.conf" /etc/nginx/sites-available/pms
ln -sfn /etc/nginx/sites-available/pms /etc/nginx/sites-enabled/pms
nginx -t -q && systemctl reload nginx
ok "nginx serving https://$DOMAIN (auto-renewal via certbot.timer)"

# ── Scheduled backups ────────────────────────────────────────────────
log "Scheduling nightly backups"
cat > /etc/cron.d/pms-backup <<EOF
# PMS nightly backup: PostgreSQL dump + hard-linked media snapshot
SHELL=/bin/bash
30 2 * * * $APP_USER $APP_ROOT/bin/backup.sh --label nightly --with-media >> $APP_ROOT/shared/logs/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/pms-backup

cat > /etc/logrotate.d/pms <<EOF
$APP_ROOT/shared/logs/backup.log {
    weekly
    rotate 12
    compress
    missingok
    notifempty
    su $APP_USER www-data
}
EOF
ok "Nightly at 02:30; retention handled by backup.sh"

# ── Firewall & updates ───────────────────────────────────────────────
log "Firewall and security updates"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ok "UFW: SSH, HTTP, HTTPS only (PostgreSQL is local-only)"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
ok "Unattended security upgrades enabled"

# ── Done ─────────────────────────────────────────────────────────────
log "Bootstrap complete"
cat <<EOF

  Next steps
  ──────────
  1. Review $ENV_FILE (SENTRY_DSN, etc.)
  2. Add the server's host key to GitHub (secret VPS_KNOWN_HOSTS):
       ssh-keyscan -t ed25519 $DOMAIN
  3. Push to main. The first deploy creates the schema and goes live.
  4. Create the first admin:
       sudo -u $APP_USER $APP_ROOT/current/venv/bin/python $APP_ROOT/current/manage.py createsuperuser

  Migrating data from the old server:
       sudo -u $APP_USER $APP_ROOT/bin/restore_db.sh /path/to/old.dump

EOF
