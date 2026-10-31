# PMS Production Deployment Runbook

**Production:** https://pms.mcdtronix.co.zw
**Stack:** Ubuntu 24.04 · nginx · Gunicorn · Django 5.2 · PostgreSQL 16 · React (static)
**Delivery:** GitHub Actions, on every push to `main`

---

## 1. How a deploy works

```
push to main
  ├── backend    Django deploy checks · migrations on PostgreSQL 16 · collectstatic · unit tests
  ├── frontend   production build · bundle must target https://pms.mcdtronix.co.zw/api
  └── scripts    shellcheck of the deploy toolkit
        └── package   one immutable archive: server code + built SPA (sha256-verified)
              └── deploy  (on the server, scripts/deploy/deploy.sh)
                    1 Preflight   lock · config · PostgreSQL · disk · current health
                    2 Backup      verified pg_dump → /var/backups/pms/db   ← restore point
                    3 Stage       releases/<timestamp>_<sha>, linked to shared .env/media/logs
                    4 Build       fresh virtualenv · engine must be PostgreSQL · check --deploy
                    5 Migrate     apply migrations (only step that touches production data)
                    6 Candidate   boot NEW release on 127.0.0.1:8099 and test it while
                                  users are still served by the OLD release
                    7 Switch      atomic symlink flip · restart · socket + public HTTPS checks
                    8 Finalize    record state · keep last 5 releases
                    └── smoke     end-to-end tests against the live URL
                          └── rollback  only if smoke fails
```

**Failure handling:**

| Fails at | Production impact | What happens automatically |
|---|---|---|
| CI (backend/frontend/scripts) | none | Nothing is deployed |
| Preflight / Backup | none | Deploy aborts before touching anything |
| Stage / Build | none | Release discarded |
| Migrate / Candidate | old release still serving | DB restored from step-2 backup (if migrations ran) |
| Switch | brief | Traffic returned to previous release, DB restored if migrated |
| Smoke tests | new release live | `rollback.sh` returns to previous release |

Every database restore first takes a `pre-rollback` safety dump, so data written since the deploy can always be recovered.

## 2. One-time server setup

**Prerequisites**
- Ubuntu 24.04 VPS, root/sudo access
- DNS `A` record: `pms.mcdtronix.co.zw` → server IP (must resolve before step 2)

**Step 1: Generate a dedicated CI deploy key** (on your machine; never reuse a personal key):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-pms" -f pms_deploy_key
```

**Step 2: Provision the server:**

```bash
git clone https://github.com/Mcdtronix/Prison_Management_System.git /tmp/pms-src
cd /tmp/pms-src
sudo LETSENCRYPT_EMAIL=you@example.com \
     DEPLOY_PUBKEY="$(cat pms_deploy_key.pub)" \
     bash deploy/server/bootstrap.sh
```

This installs PostgreSQL 16, nginx and certbot. It creates the `pms` user, the database, `/var/www/pms/shared/.env` (with a generated `SECRET_KEY` and DB password), the systemd unit, the TLS certificate, the firewall rules and nightly backups. It is safe to re-run.

**Step 3: Add GitHub secrets** (repo → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP or hostname |
| `VPS_USER` | `pms` |
| `VPS_SSH_KEY` | contents of `pms_deploy_key` (private) |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <VPS_HOST>` |
| `VPS_PORT` | *(optional)* SSH port if not 22 |
| `SMOKE_TEST_USER` / `SMOKE_TEST_PASS` | *(optional)* dedicated low-privilege account |

Also create a **`production` environment** (Settings → Environments). Add required reviewers there if you want a manual approval before each deploy.

**Step 4: First deploy.** Push to `main`, or run Actions → *Deploy to Production* → *Run workflow*. Then create the first admin:

```bash
sudo -u pms /var/www/pms/current/venv/bin/python /var/www/pms/current/manage.py createsuperuser
```

**Step 5: Migrate data from the old server** (if applicable):

```bash
# old server
pg_dump --format=custom -f pms_import.dump <old_db_name>
# new server (after copying the file over)
sudo -u pms /var/www/pms/bin/restore_db.sh /path/to/pms_import.dump
```

## 3. Day-to-day operations

All commands run on the server as the `pms` user (`sudo -iu pms`).

| Task | Command |
|---|---|
| App status / logs | `systemctl status pms` · `journalctl -u pms -f` |
| Deploy history | `cat /var/www/pms/shared/state/history.log` |
| Last deploy log | `ls -t /var/www/pms/shared/logs/deploy_*.log \| head -1 \| xargs less` |
| Live release | `readlink /var/www/pms/current` |
| Releases on disk | `ls -1t /var/www/pms/releases` |
| Manual backup | `/var/www/pms/bin/backup.sh --label manual` |
| List backups | `/var/www/pms/bin/restore_db.sh --list` |
| Roll back (previous) | `/var/www/pms/bin/rollback.sh` |
| Roll back (specific) | `/var/www/pms/bin/rollback.sh --to 20261031183000_ab12cd3` |
| Code-only rollback | `/var/www/pms/bin/rollback.sh --restore-db no` |
| Restore a backup | `/var/www/pms/bin/restore_db.sh /var/backups/pms/db/<file>.dump` |
| Django shell | `cd /var/www/pms/current && venv/bin/python manage.py shell` |

You can also roll back from GitHub: Actions → *Rollback Production* → *Run workflow*.

## 4. Backups

| Type | When | Where | Retention |
|---|---|---|---|
| `pre-deploy` | every deploy, before any change | `/var/backups/pms/db` | 30 days, newest 10 always kept |
| `nightly` | 02:30 daily (DB + media snapshot) | `/var/backups/pms/{db,media}` | 30 days DB · 14 media snapshots |
| `pre-rollback` / `pre-restore` | before any restore | `/var/backups/pms/db` | 30 days, newest 10 always kept |

DB archives are `pg_dump` custom format. Each one is verified after writing (`pg_restore --list`) and gets a `.sha256` sidecar. Restores replace the schema in a **single transaction**, so a failed restore leaves the database unchanged.

> **Off-site copies are not configured.** Backups on the same disk do not survive loss of the server. Sync `/var/backups/pms` to off-site storage (e.g. `rclone` to S3/B2) on a schedule.

## 5. Writing migrations safely

Migrations run in step 5 while the **previous** release is still serving users. During that window the old code runs against the new schema. Keep migrations **backward-compatible within one deploy**:

- ✅ Add tables, nullable columns, or columns with defaults
- ⚠️ Rename or drop a column in two deploys: first stop using it in code, then remove it in the next deploy
- ⚠️ Long data migrations lock tables; schedule them outside working hours

## 6. Security notes

- **Media is private.** nginx marks `/media/` as `internal`, so inmate photos, warrants and officer documents are **not** downloadable by URL. Until Django serves them to authenticated users through `X-Accel-Redirect` (not implemented yet), uploaded files do not display in production.
- The app server listens only on a unix socket, and PostgreSQL only on localhost. UFW allows SSH, HTTP and HTTPS only.
- The CI deploy user can restart `pms` and reload nginx, nothing else (`/etc/sudoers.d/pms-deploy`).
- `shared/.env` is `chmod 600` and never leaves the server.
