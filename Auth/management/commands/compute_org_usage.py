"""Measure how much data each province and station holds. Run nightly (cron or systemd timer).

    python manage.py compute_org_usage
"""
from django.core.management.base import BaseCommand
from django.db.models import Sum

from Auth.usage import compute_org_usage, database_size, latest_snapshot


class Command(BaseCommand):
    help = 'Store a fresh per-unit storage snapshot for the admin console.'

    def handle(self, *args, **opts):
        compute_org_usage()
        rows, at = latest_snapshot()
        total = rows.aggregate(b=Sum('est_bytes'))['b'] or 0
        db = database_size()
        self.stdout.write(self.style.SUCCESS(
            f'Snapshot {at:%Y-%m-%d %H:%M}: {rows.count()} rows, about {total / 1e6:.1f} MB of records'
            + (f' (database is {db / 1e6:.1f} MB in total)' if db else '')))
