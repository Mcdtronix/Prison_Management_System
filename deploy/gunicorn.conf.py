"""
Gunicorn configuration for PMS production.

Loaded by deploy/systemd/pms.service from the active release:
    gunicorn Core.wsgi:application -c /var/www/pms/current/deploy/gunicorn.conf.py

Every value can be overridden from the environment (see shared/.env) so the
server can be tuned without a code change.
"""
import multiprocessing
import os

# Unix socket: only nginx (group www-data) can reach the app server.
bind = os.getenv("GUNICORN_BIND", "unix:/run/pms/gunicorn.sock")
umask = 0o007

workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "sync"
threads = int(os.getenv("GUNICORN_THREADS", "1"))

# Report exports and PDF generation can run long; nginx is set to match.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
keepalive = 5

# Recycle workers periodically to contain slow memory growth.
max_requests = 1000
max_requests_jitter = 100

# Logs go to stdout/stderr and are collected by journald (journalctl -u pms).
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(L)ss "%(a)s"'

proc_name = "pms"
forwarded_allow_ips = "127.0.0.1"
