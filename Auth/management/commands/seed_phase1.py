"""Management command: seed_phase1
Idempotent seeding of Roles, Departments, example OrgUnits, Stations and example UserAssignments.

Usage:
  python manage.py seed_phase1

This command is safe to run multiple times.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Seed initial Roles, Departments, OrgUnits, Stations and example UserAssignments for Phase 1'

    def handle(self, *args, **options):
        from Auth.models import (
            Role,
            Department,
            OrgUnit,
            OrgUnitDepartment,
            UserAssignment,
            SystemConfig,
        )
        from Auth.models import Station, UserProfile
        from django.conf import settings

        # 1) Seed Roles
        roles = [
            ('SUPER_ADMIN', 'Super Administrator'),
            ('ADMIN_OFFICER', 'Administration Officer'),
            ('RECEPTION_OFFICER', 'Reception Officer'),
            ('HEALTH_OFFICER', 'Health Officer'),
            ('STORES_OFFICER', 'Stores Officer'),
            ('FARMS_OFFICER', 'Farms Officer'),
            ('HR_OFFICER', 'Human Resources Officer'),
            ('AUDITOR', 'Auditor'),
        ]

        for code, name in roles:
            r, created = Role.objects.get_or_create(code=code, defaults={'name': name})
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Role: {code}'))

        # 2) Seed Departments
        departments = [
            ('RECEPTION', 'Reception / Admissions'),
            ('HEALTH', 'Health / Medical Services'),
            ('HUMAN_RESOURCES', 'Human Resources / Personnel'),
            ('STORES', 'Stores / Logistics'),
            ('FARMS', 'Farms / Production'),
        ]

        for code, name in departments:
            d, created = Department.objects.get_or_create(code=code, defaults={'name': name})
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Department: {code}'))

        # 3) Ensure there is a National HQ OrgUnit (use SystemConfig or settings fallback)
        national_code = getattr(settings, 'INITIAL_ORG_CODE', 'NAT_HQ_001')
        national_name = getattr(settings, 'INITIAL_ORG_NAME', 'National Headquarters')

        national_hq, created = OrgUnit.objects.get_or_create(
            code=national_code,
            defaults={'name': national_name, 'code_short': 'NAT_HQ', 'unit_type': 'NATIONAL_HQ'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created OrgUnit: {national_hq.code}'))

        # 4) Create an example province and station (idempotent)
        prov_code = f'{national_hq.code}_PROV_1'
        prov_name = f'{national_hq.name} Province 1'
        prov, created = OrgUnit.objects.get_or_create(
            code=prov_code,
            defaults={'name': prov_name, 'code_short': 'PROV1', 'unit_type': 'PROVINCIAL_HQ', 'parent': national_hq}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created OrgUnit: {prov.code}'))

        stn_code = f'{prov.code}_STN_1'
        stn_name = f'{prov.name} Station 1'
        stn, created = OrgUnit.objects.get_or_create(
            code=stn_code,
            defaults={'name': stn_name, 'code_short': 'STN1', 'unit_type': 'STATION', 'parent': prov}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created OrgUnit: {stn.code}'))

        # 5) Create a Station (legacy model used by UserProfile)
        station_obj, created = Station.objects.get_or_create(code=stn.code, defaults={'name': stn.name, 'location': '', 'active': True})
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created Station: {station_obj.code}'))

        # 6) Map departments to OrgUnits via OrgUnitDepartment if not already mapped
        for dep_code, _ in departments:
            dep = Department.objects.get(code=dep_code)
            oud, created = OrgUnitDepartment.objects.get_or_create(org_unit=stn, department=dep, defaults={'mailbox_address': f'{stn.code}.{dep.code}@example.local'})
            if created:
                self.stdout.write(self.style.SUCCESS(f'Added Department {dep.code} to {stn.code}'))

        # 7) Create example users and assignments
        examples = [
            ('seed_superadmin', 'Super', 'Admin', 'SUPER_ADMIN', national_hq, None),
            ('prov_admin', 'Prov', 'Admin', 'ADMIN_OFFICER', prov, None),
            ('station_admin', 'Station', 'Admin', 'ADMIN_OFFICER', stn, None),
            ('reception1', 'Reception', 'One', 'RECEPTION_OFFICER', stn, 'RECEPTION'),
            ('health1', 'Health', 'One', 'HEALTH_OFFICER', stn, 'HEALTH'),
            ('stores1', 'Stores', 'One', 'STORES_OFFICER', stn, 'STORES'),
        ]

        for username, first, last, role_code, unit, dept_code in examples:
            user, created = User.objects.get_or_create(username=username, defaults={'first_name': first, 'last_name': last, 'is_active': True, 'email': f'{username}@example.local'})
            if created:
                user.set_password('ChangeMe123!')
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Created user {username} with default password'))

            # Create or update legacy UserProfile (if the model exists)
            try:
                profile, pcreated = UserProfile.objects.get_or_create(user=user, defaults={'role': Role.objects.get(code=role_code), 'station': station_obj, 'is_active': True})
                if not pcreated:
                    profile.role = Role.objects.get(code=role_code)
                    profile.station = station_obj
                    profile.is_active = True
                    profile.save()
            except Exception:
                # If UserProfile is not present for this user, ignore
                profile = None

            role = Role.objects.get(code=role_code)
            dept = None
            if dept_code:
                dept = Department.objects.get(code=dept_code)

            ua, uac = UserAssignment.objects.get_or_create(
                user=user,
                role=role,
                org_unit=unit,
                department=dept,
                defaults={'is_primary': True, 'is_active': True, 'created_by_id': user.id}
            )
            if uac:
                self.stdout.write(self.style.SUCCESS(f'Created assignment for {username}: {role_code} @ {unit.code}'))

        # 8) Ensure SystemConfig references national HQ
        sc, created = SystemConfig.objects.get_or_create(defaults={'national_hq': national_hq, 'setup_status': 'INITIALIZED'})
        if not sc.national_hq:
            sc.national_hq = national_hq
            sc.save()

        self.stdout.write(self.style.SUCCESS('Phase1 seed completed. Review created users and change passwords.'))