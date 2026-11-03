"""Create Zimbabwe's 10 provinces under National HQ and place the known stations.

Dry run (shows what would happen, changes nothing):
    python manage.py setup_zimbabwe_structure

Apply:
    python manage.py setup_zimbabwe_structure --apply

Safe to re-run. Existing provinces and stations are matched by code or name
and reused, never duplicated; their names are not changed. A station that
exists in the old station table is linked to it, and its users get matching
role assignments.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from Auth.models import OrgUnit, Station

from .link_legacy_stations import assign_profiles

# code, short code, name, other names it may already exist under
PROVINCES = [
    ('BYO', 'BYO', 'Bulawayo Metropolitan Province', ['bulawayo']),
    ('HRE', 'HRE', 'Harare Metropolitan Province', ['harare']),
    ('MANICALAND', 'MANICA', 'Manicaland Province', ['manicaland']),
    ('MASH_CENTRAL', 'MASH_C', 'Mashonaland Central Province', ['mashonaland central']),
    ('MASH_EAST', 'MASH_E', 'Mashonaland East Province', ['mashonaland east']),
    ('MASH_WEST', 'MASH_W', 'Mashonaland West Province', ['mashonaland west']),
    ('MASVINGO', 'MSV', 'Masvingo Province', ['masvingo']),
    ('MAT_NORTH', 'MAT_N', 'Matabeleland North Province', ['matabeleland north']),
    ('MAT_SOUTH', 'MAT_S', 'Matabeleland South Province', ['matabeleland south']),
    ('MIDLANDS', 'MIDLANDS', 'Midlands Province', ['midlands']),
]

# code, short code, name, province code, words that identify it
STATIONS = [
    ('CHIKURUBI_MAX', 'CHIKURUBI', 'Chikurubi Maximum Prison', 'HRE', ['chikurub']),
    ('HRE_CENTRAL', 'HRE_CENTRAL', 'Harare Central Prison', 'HRE', ['harare central', 'hre_cntrl']),
    ('HRE_REMAND', 'HRE_REMAND', 'Harare Remand Prison', 'HRE', ['harare remand', 'hre_rmnd']),
    ('CHIVHU', 'CHIVHU', 'Chivhu Prison', 'MASH_EAST', ['chivhu']),
    ('RIDIGITA', 'RIDIGITA', 'Ridigita Prison', 'MASH_EAST', ['ridigita']),
    ('MARONDERA', 'MARONDERA', 'Marondera Prison', 'MASH_EAST', ['marondera', 'st thomas']),
]


def _find(queryset, code, words):
    """Match by exact code, then by any identifying word in the name or code."""
    hit = queryset.filter(code=code).first()
    if hit:
        return hit
    for row in queryset:
        text = f'{row.name} {row.code}'.lower()
        if any(w in text for w in words):
            return row
    return None


class Command(BaseCommand):
    help = "Create Zimbabwe's 10 provinces and place the known stations under them."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write the changes. Without it, dry run.')

    def handle(self, *args, **opts):
        apply = opts['apply']
        out = self.stdout.write
        warn = lambda m: out(self.style.WARNING(m))  # noqa: E731

        nhq = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
        if nhq is None:
            raise CommandError('National HQ does not exist yet. Run the setup wizard first.')

        out(self.style.MIGRATE_HEADING(
            f'Provinces under {nhq.name}' + ('' if apply else '  (dry run, nothing is written)')))
        made = {'provinces': 0, 'stations': 0, 'moved': 0, 'assignments': 0}

        with transaction.atomic():
            provinces = {}
            for code, short, name, words in PROVINCES:
                unit = _find(OrgUnit.objects.filter(unit_type='PROVINCIAL_HQ'), code, words)
                if unit:
                    out(f'  {code:<13} exists as {unit.code} "{unit.name}"')
                else:
                    out(f'  {code:<13} create "{name}"')
                    made['provinces'] += 1
                    if apply:
                        unit = OrgUnit.objects.create(code=code, code_short=short, name=name,
                                                      unit_type='PROVINCIAL_HQ', parent=nhq)
                provinces[code] = unit

            out(self.style.MIGRATE_HEADING('\nStations'))
            for code, short, name, prov_code, words in STATIONS:
                province = provinces[prov_code]
                legacy = _find(Station.objects.all(), code, words)
                unit = _find(OrgUnit.objects.filter(unit_type='STATION'), code, words)
                label = f'  {name:<27} -> {prov_code:<10}'

                if unit is None:
                    use_name = legacy.name if legacy else name
                    out(f'{label} create' + (f' (linked to old station "{legacy.code}")' if legacy else ''))
                    made['stations'] += 1
                    if apply:
                        unit = OrgUnit.objects.create(
                            code=code, code_short=short, name=use_name, unit_type='STATION', parent=province,
                            location=getattr(legacy, 'location', None),
                        )
                elif province is not None and unit.parent_id != province.pk:
                    out(f'{label} move {unit.code} from {unit.parent.code if unit.parent else "-"}')
                    made['moved'] += 1
                    if apply:
                        unit.parent = province
                        unit.save()
                else:
                    out(f'{label} already in place as {unit.code}')

                if legacy is not None:
                    made['assignments'] += assign_profiles(legacy, unit, apply, out, warn)

            if not apply:
                transaction.set_rollback(True)

        verb = 'Done' if apply else 'Would do'
        out(self.style.SUCCESS(
            f"{verb}: {made['provinces']} province(s) and {made['stations']} station(s) created, "
            f"{made['moved']} moved, {made['assignments']} user assignment(s) added."))
