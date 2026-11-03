"""Estimate how much of the database each org unit holds.

For every table in the project's apps:

* if it has an owner column (an OrgUnit, or a legacy Station mapped to its
  OrgUnit), rows are counted per unit;
* rows with an empty owner column are counted as UNASSIGNED;
* tables with no owner column at all are SHARED (system-wide).

Bytes are estimated as rows x the table's average row size. On PostgreSQL the
average comes from the table's real on-disk size (including indexes); on
other databases a flat 512 bytes per row is used. Results are stored as an
`OrgUsageSnapshot` batch, so the console reads them without scanning tables.
"""
from collections import defaultdict
from datetime import timedelta

from django.apps import apps
from django.db import connection, transaction
from django.db.models import Count
from django.utils import timezone

from .models import OrgUnit, OrgUsageSnapshot, Station

PROJECT_APPS = ('Auth', 'Reception', 'Health', 'Stores', 'Farms', 'HumanResources', 'Cases', 'Messaging', 'Reports')

# Owner columns, most specific first.
OWNER_FIELDS = ('owner_org_unit', 'org_unit', 'station', 'posting_org_unit', 'receiving_org_unit',
                'providing_org_unit', 'consuming_org_unit', 'source_org_unit')

# Usage bookkeeping is not counted as data.
SKIP_MODELS = {'Auth.OrgUsageSnapshot'}

FALLBACK_ROW_BYTES = 512
KEEP_DAYS = 90


def _owner_field(model):
    names = {f.name: f for f in model._meta.concrete_fields if f.is_relation and f.many_to_one}
    for name in OWNER_FIELDS:
        field = names.get(name)
        if field is not None and field.related_model in (OrgUnit, Station):
            return field
    return None


def _station_to_unit():
    """Map legacy Station ids to OrgUnit ids by code or name."""
    units_by_code = {}
    units_by_name = {}
    for u in OrgUnit.objects.all().only('id', 'code', 'code_short', 'name'):
        units_by_code[u.code] = u.id
        units_by_code.setdefault(u.code_short, u.id)
        units_by_name[u.name.lower()] = u.id
    return {
        s.id: units_by_code.get(s.code) or units_by_name.get(s.name.lower())
        for s in Station.objects.all().only('id', 'code', 'name')
    }


def _table_bytes_per_row(table, rows):
    if connection.vendor != 'postgresql' or rows == 0:
        return FALLBACK_ROW_BYTES
    with connection.cursor() as cur:
        cur.execute('SELECT pg_total_relation_size(%s)', [table])
        total = cur.fetchone()[0] or 0
    return max(int(total / rows), 1)


def database_size():
    """Total size of the database in bytes, or None if unknown."""
    if connection.vendor != 'postgresql':
        return None
    with connection.cursor() as cur:
        cur.execute('SELECT pg_database_size(current_database())')
        return cur.fetchone()[0]


def compute_org_usage():
    """Measure every table and store one snapshot batch. Returns the capture time."""
    captured_at = timezone.now()
    station_map = _station_to_unit()
    rows_out = []

    for model in apps.get_models():
        meta = model._meta
        if meta.app_label not in PROJECT_APPS or meta.label in SKIP_MODELS or meta.proxy or not meta.managed:
            continue
        table = meta.db_table
        total = model._default_manager.count()
        per_row = _table_bytes_per_row(table, total)
        field = _owner_field(model)

        if field is None:
            if total:
                rows_out.append(OrgUsageSnapshot(scope='SHARED', table_name=table, module=meta.app_label,
                                                 row_count=total, est_bytes=total * per_row,
                                                 captured_at=captured_at))
            continue

        counts = defaultdict(int)
        for row in model._default_manager.values(field.attname).annotate(n=Count('pk')).order_by():
            owner = row[field.attname]
            if owner is not None and field.related_model is Station:
                owner = station_map.get(owner)
            counts[owner] += row['n']

        for owner, n in counts.items():
            rows_out.append(OrgUsageSnapshot(
                org_unit_id=owner, scope='OWNED' if owner else 'UNASSIGNED', table_name=table,
                module=meta.app_label, row_count=n, est_bytes=n * per_row, captured_at=captured_at,
            ))

    with transaction.atomic():
        OrgUsageSnapshot.objects.bulk_create(rows_out)
        OrgUsageSnapshot.objects.filter(captured_at__lt=captured_at - timedelta(days=KEEP_DAYS)).delete()
    return captured_at


def latest_snapshot():
    """The newest snapshot batch as a queryset (empty if none has been taken)."""
    latest = OrgUsageSnapshot.objects.order_by('-captured_at').values_list('captured_at', flat=True).first()
    if latest is None:
        return OrgUsageSnapshot.objects.none(), None
    return OrgUsageSnapshot.objects.filter(captured_at=latest), latest
