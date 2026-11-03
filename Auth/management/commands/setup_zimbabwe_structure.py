"""Create National HQ, Zimbabwe's 10 provinces and the known stations.

On a new database this also creates National HQ and marks setup as ready.

Dry run (shows what would happen, changes nothing):
    python manage.py setup_zimbabwe_structure

Apply:
    python manage.py setup_zimbabwe_structure --apply

Also make an existing account the HQ System Admin (IT department, National HQ):
    python manage.py setup_zimbabwe_structure --apply --hq-admin 2934823Z

Safe to re-run. Existing provinces and stations are matched by code or name
and reused, never duplicated; their names are not changed. A station that
exists in the old station table is linked to it, and its users get matching
role assignments.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from django.contrib.auth import get_user_model
from django.core.management.base import CommandError

from Auth.models import OrgUnit, Role, Station, SystemConfig, UserAssignment

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
    help = "Create National HQ (if missing), Zimbabwe's 10 provinces and the known stations."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write the changes. Without it, dry run.')
        parser.add_argument('--hq-admin', metavar='USERNAME',
                            help='Give this existing account the HQ System Admin role at National HQ.')

    def handle(self, *args, **opts):
        apply = opts['apply']
        out = self.stdout.write
        warn = lambda m: out(self.style.WARNING(m))  # noqa: E731

        made = {'provinces': 0, 'stations': 0, 'moved': 0, 'assignments': 0}

        with transaction.atomic():
            nhq = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
            if nhq is None:
                out(self.style.MIGRATE_HEADING('National HQ' + ('' if apply else '  (dry run, nothing is written)')))
                out('  NAT_HQ        create "National Headquarters"')
                # Created even in a dry run so the rest can be previewed; rolled back below.
                nhq = OrgUnit.objects.create(code='NAT_HQ', code_short='NHQ', name='National Headquarters',
                                             unit_type='NATIONAL_HQ', location='Harare')
            config = SystemConfig.objects.first()
            if config is None:
                SystemConfig.objects.create(national_hq=nhq, setup_status='READY')
            elif config.national_hq_id is None:
                config.national_hq = nhq
                if config.setup_status == 'UNINITIALIZED':
                    config.setup_status = 'READY'
                config.save()

            out(self.style.MIGRATE_HEADING(
                '\nProvinces under ' + nhq.name + ('' if apply else '  (dry run, nothing is written)')))
            provinces = {}
            for code, short, name, words in PROVINCES:
                unit = _find(OrgUnit.objects.filter(unit_type='PROVINCIAL_HQ'), code, words)
                if unit:
                    out(f'  {code:<13} exists as {unit.code} "{unit.name}"')
                else:
                    out(f'  {code:<13} create "{name}"')
                    made['provinces'] += 1
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
                    unit = OrgUnit.objects.create(
                        code=code, code_short=short, name=use_name, unit_type='STATION', parent=province,
                        location=getattr(legacy, 'location', None),
                    )
                elif unit.parent_id != province.pk:
                    out(f'{label} move {unit.code} from {unit.parent.code if unit.parent else "-"}')
                    made['moved'] += 1
                    unit.parent = province
                    unit.save()
                else:
                    out(f'{label} already in place as {unit.code}')

                if legacy is not None:
                    made['assignments'] += assign_profiles(legacy, unit, True, out, warn)

            if opts.get('hq_admin'):
                self._make_hq_admin(opts['hq_admin'], nhq, out)

            if not apply:
                transaction.set_rollback(True)

        verb = 'Done' if apply else 'Would do'
        out(self.style.SUCCESS(
            f"{verb}: {made['provinces']} province(s) and {made['stations']} station(s) created, "
            f"{made['moved']} moved, {made['assignments']} user assignment(s) added."))

    def _make_hq_admin(self, username, nhq, out):
        user = get_user_model().objects.filter(username=username).first()
        if user is None:
            raise CommandError(f'No account with username {username!r}. Create it first (createsuperuser).')
        role = Role.objects.get(code='HQ_SYS_ADMIN')
        out(self.style.MIGRATE_HEADING('\nHQ System Admin'))
        if UserAssignment.objects.filter(user=user, role=role, org_unit=nhq, is_active=True).exists():
            out(f'  {username} is already HQ System Admin')
            return
        has_primary = UserAssignment.objects.filter(user=user, is_primary=True, is_active=True).exists()
        UserAssignment.objects.create(user=user, role=role, org_unit=nhq, department=role.department,
                                      is_primary=not has_primary, is_active=True)
        out(f'  {username} -> HQ System Admin at {nhq.code} (IT)')
