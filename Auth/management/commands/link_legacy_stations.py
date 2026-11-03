"""Link old-style stations (auth_station) into the province -> station tree.

The system can't tell which province a legacy station belongs to, so a
person supplies the mapping. Each mapped station gets a matching STATION
org unit (same code and name), and each of its user profiles gets a primary
UserAssignment there, so those users fall under the new permission engine.

Dry run (shows what would happen, changes nothing):
    python manage.py link_legacy_stations --map HRE_CNTRL=HRE --map Chivhu=MASH_EAST

Apply:
    python manage.py link_legacy_stations --map HRE_CNTRL=HRE --apply

Map a station to National HQ itself with --map HQ=NAT_HQ (no new unit is created).
Safe to re-run: existing units and assignments are reused, never duplicated.
"""
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from Auth.models import Department, OrgUnit, Station, UserAssignment, UserProfile
from Auth.utils import normalize_role_code

# Department to use for a profile's assignment, by role. First match wins.
DEPARTMENT_FOR_ROLE = {
    'RECEPTION_OFFICER': ['RECEPTION', 'REC'],
    'HEALTH_OFFICER': ['HEALTH'],
    'STORES_OFFICER': ['STORES'],
    'FARMS_OFFICER': ['FARMS'],
    'HR_OFFICER': ['HR', 'HUMAN_RESOURCES', 'ADMINISTRATION', 'ADMIN'],
}
ADMIN_DEPARTMENTS = ['ADMINISTRATION', 'ADMIN', 'SYS_ADMIN']


def _existing_unit(station):
    return (OrgUnit.objects.filter(code=station.code).first()
            or OrgUnit.objects.filter(code=station_code(station.code)).first()
            or OrgUnit.objects.filter(code_short=station.code).first()
            or OrgUnit.objects.filter(name=station.name).first())


def _department(role):
    if role.department_id:
        return role.department
    codes = DEPARTMENT_FOR_ROLE.get(normalize_role_code(role.code), []) + ADMIN_DEPARTMENTS
    for code in codes:
        dept = Department.objects.filter(code=code).first()
        if dept:
            return dept
    return None


def station_code(raw):
    """An org-unit code from a legacy code: 'St Thomas Prison' -> 'ST_THOMAS_PRISON'."""
    return re.sub(r'[^A-Z0-9]+', '_', raw.upper()).strip('_')[:50]


def assign_profiles(station, unit, apply, write, warn):
    """Give each legacy profile at `station` a primary assignment at `unit`. Returns the count."""
    count = 0
    for profile in UserProfile.objects.filter(station=station).select_related('user', 'role'):
        if UserAssignment.objects.filter(user=profile.user, is_active=True, is_primary=True).exists():
            continue
        dept = _department(profile.role)
        if dept is None:
            warn(f'      {profile.user.username}: no suitable department exists, skipped')
            continue
        write(f'      {profile.user.username:<18} {profile.role.code:<18} dept={dept.code}')
        if apply and unit is not None:
            UserAssignment.objects.create(
                user=profile.user, role=profile.role, org_unit=unit, department=dept,
                is_primary=True, is_active=profile.is_active,
            )
        count += 1
    return count


class Command(BaseCommand):
    help = 'Create STATION org units for legacy stations and give their users matching assignments.'

    def add_arguments(self, parser):
        parser.add_argument('--map', action='append', default=[], metavar='STATION=PROVINCE',
                            help='Legacy station code = parent org unit code. Repeat for each station.')
        parser.add_argument('--apply', action='store_true', help='Write the changes. Without it, dry run.')

    def handle(self, *args, **opts):
        mapping = {}
        for item in opts['map']:
            if '=' not in item:
                raise CommandError(f'Bad --map value {item!r}; use STATION_CODE=PROVINCE_CODE.')
            station_code, parent_code = (x.strip() for x in item.split('=', 1))
            mapping[station_code] = parent_code

        apply = opts['apply']
        out = self.stdout.write
        out(self.style.MIGRATE_HEADING('Legacy stations' + ('' if apply else '  (dry run, nothing is written)')))

        unknown = set(mapping) - set(Station.objects.values_list('code', flat=True))
        if unknown:
            raise CommandError(f'No legacy station with code: {", ".join(sorted(unknown))}')

        created_units = created_assignments = 0
        with transaction.atomic():
            for station in Station.objects.order_by('name'):
                users = UserProfile.objects.filter(station=station).select_related('user', 'role')
                unit = _existing_unit(station)
                if unit is None and station.code not in mapping:
                    out(f'  {station.code:<20} {station.name:<35} NOT LINKED ({users.count()} users) - add --map {station.code}=<PROVINCE>')
                    continue

                if unit is None:
                    parent = OrgUnit.objects.filter(code=mapping[station.code]).first()
                    if parent is None:
                        raise CommandError(f'No org unit with code {mapping[station.code]!r}.')
                    if parent.unit_type == 'NATIONAL_HQ':
                        unit = parent
                        out(f'  {station.code:<20} -> {parent.code} (National HQ itself)')
                    elif parent.unit_type != 'PROVINCIAL_HQ':
                        raise CommandError(f'{parent.code} is not a province or National HQ.')
                    else:
                        out(f'  {station.code:<20} -> new station unit under {parent.code}')
                        if apply:
                            unit = OrgUnit.objects.create(
                                code=station_code(station.code), name=station.name, code_short=station.code[:20],
                                unit_type='STATION', parent=parent, location=station.location,
                                active=station.active,
                            )
                        created_units += 1
                else:
                    out(f'  {station.code:<20} already linked to {unit.code} ({unit.get_unit_type_display()})')

                created_assignments += assign_profiles(
                    station, unit, apply, out, lambda m: out(self.style.WARNING(m)))

            if not apply:
                transaction.set_rollback(True)

        verb = 'Created' if apply else 'Would create'
        out(self.style.SUCCESS(f'{verb} {created_units} station unit(s) and {created_assignments} assignment(s).'))
