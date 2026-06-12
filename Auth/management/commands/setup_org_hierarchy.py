"""
Management command for Phase 1 data backfill and organizational hierarchy setup
================================================================================
Performs initial data migration from single-level (Station) to three-level
organizational hierarchy (National → Provincial → Station).

Key operations:
1. Create National HQ organizational unit
2. Create Provincial organizational units
3. Link existing Stations to Provincial units
4. Backfill owner_org_unit fields across all domain models
5. Create initial UserAssignments for existing users

Usage:
    python manage.py setup_org_hierarchy

Options:
    --create-hierarchy    Create the organizational hierarchy structure
    --backfill-data       Backfill owner_org_unit fields on domain models
    --create-assignments  Create initial UserAssignments for existing users
    --full-setup          Run all operations (default if no options specified)
    --reset              Clear all organizational data (careful!)
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth.models import User
from Auth.models import (
    OrgUnit, Department, OrgUnitDepartment, Role, Station, UserProfile, 
    UserAssignment, SystemConfig
)
from Reception.models import Inmate
from Health.models import Patient, AdmissionHealthAssessment
from Stores.models import StockReceipt, FeedingSession
from Farms.models import FarmProject
from HumanResources.models import OfficerStationHistory
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Phase 1: Setup organizational hierarchy and backfill ownership data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-hierarchy',
            action='store_true',
            help='Create National HQ, Provincial, and Station org units',
        )
        parser.add_argument(
            '--backfill-data',
            action='store_true',
            help='Backfill owner_org_unit fields on all domain models',
        )
        parser.add_argument(
            '--create-assignments',
            action='store_true',
            help='Create initial UserAssignments for existing users',
        )
        parser.add_argument(
            '--full-setup',
            action='store_true',
            help='Run all setup operations (default)',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='DANGER: Clear all organizational data',
        )

    def handle(self, *args, **options):
        # Determine which operations to run
        any_option = (
            options.get('create_hierarchy') or 
            options.get('backfill_data') or 
            options.get('create_assignments') or 
            options.get('reset')
        )
        
        run_full = options.get('full_setup') or not any_option
        
        try:
            if options.get('reset'):
                self.reset_hierarchy()
            
            if run_full or options.get('create_hierarchy'):
                self.create_organizational_hierarchy()
            
            if run_full or options.get('backfill_data'):
                self.backfill_ownership_data()
            
            if run_full or options.get('create_assignments'):
                self.create_initial_assignments()
            
            self.stdout.write(
                self.style.SUCCESS('\n✓ Phase 1 organizational setup completed successfully!')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'\n✗ Setup failed: {str(e)}')
            )
            raise

    def reset_hierarchy(self):
        """DANGER: Clear all organizational hierarchy data"""
        self.stdout.write(self.style.WARNING('⚠ WARNING: Resetting all organizational hierarchy data...'))
        
        if not self._confirm('This will delete all orgunit, department, and assignment data. Continue?'):
            self.stdout.write(self.style.ERROR('Reset cancelled.'))
            return
        
        with transaction.atomic():
            # Clear all assignments first (FK dependencies)
            UserAssignment.objects.all().delete()
            OrgUnitDepartment.objects.all().delete()
            Department.objects.all().delete()
            OrgUnit.objects.all().delete()
            SystemConfig.objects.all().delete()
            
            self.stdout.write(self.style.SUCCESS('  ✓ Organizational data cleared'))

    @transaction.atomic
    def create_organizational_hierarchy(self):
        """Create three-level organizational hierarchy"""
        self.stdout.write('\n█ Creating organizational hierarchy...')
        
        # Step 1: Create National HQ
        national_hq, created = OrgUnit.objects.get_or_create(
            code='NAT_HQ_001',
            defaults={
                'name': 'National Headquarters',
                'code_short': 'NAT_HQ',
                'unit_type': 'NATIONAL_HQ',
                'location': 'Harare, Zimbabwe',
                'description': 'Central command and administrative center',
                'active': True,
            }
        )
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ National HQ: {national_hq.code}')
        )
        
        # Step 2: Create Provincial units
        provinces_data = [
            ('HARARE', 'Harare Province', 'Harare'),
            ('BULAWAYO', 'Bulawayo Province', 'Bulawayo'),
            ('MIDLANDS', 'Midlands Province', 'Gweru'),
            ('MASHONALAND_CENTRAL', 'Mashonaland Central Province', 'Bindura'),
            ('MASHONALAND_EAST', 'Mashonaland East Province', 'Marondera'),
            ('MASHONALAND_WEST', 'Mashonaland West Province', 'Chinhoyi'),
            ('MANICALAND', 'Manicaland Province', 'Mutare'),
            ('MASVINGO', 'Masvingo Province', 'Masvingo'),
            ('MATABELELAND_NORTH', 'Matabeleland North Province', 'Hwange'),
            ('MATABELELAND_SOUTH', 'Matabeleland South Province', 'Gwanda'),
        ]
        
        created_provinces = 0
        for code, name, location in provinces_data:
            prov_code = f'{code}_PROV'
            province, created = OrgUnit.objects.get_or_create(
                code=prov_code,
                defaults={
                    'name': name,
                    'code_short': code,
                    'unit_type': 'PROVINCIAL_HQ',
                    'parent': national_hq,
                    'location': location,
                    'active': True,
                }
            )
            if created:
                created_provinces += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Created {created_provinces} provincial units')
        )
        
        # Step 3: Link existing Stations to organizational hierarchy
        self.stdout.write('  → Linking existing stations to provinces...')
        stations = Station.objects.filter(active=True)
        self.stdout.write(
            self.style.WARNING(f'  ⊘ {stations.count()} active stations found')
        )
        
        # For now, link all stations to Harare Province (you can customize this mapping)
        harare_province = OrgUnit.objects.get(code='HARARE_PROV')
        stations_linked = 0
        for station in stations:
            # Create OrgUnit for this station if it doesn't exist
            stn_code = f'{station.code}_STN'
            station_unit, created = OrgUnit.objects.get_or_create(
                code=stn_code,
                defaults={
                    'name': station.name,
                    'code_short': station.code,
                    'unit_type': 'STATION',
                    'parent': harare_province,
                    'location': station.location or station.name,
                    'active': station.active,
                }
            )
            if created:
                stations_linked += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Linked {stations_linked} station org units')
        )
        
        # Step 4: Create master Department list
        self.stdout.write('  → Creating master department list...')
        departments_data = [
            ('RECEPTION', 'Reception/Admissions', 'Inmate admission and registration'),
            ('HEALTH', 'Health/Medical', 'Healthcare and medical services'),
            ('STORES', 'Stores/Logistics', 'Inventory and supply management'),
            ('FARMS', 'Farms/Production', 'Agricultural production'),
            ('HUMAN_RESOURCES', 'Human Resources', 'Officers and personnel management'),
            ('SECURITY', 'Security/Disciplinary', 'Security and disciplinary records'),
            ('FINANCE', 'Finance', 'Financial management and budgeting'),
            ('ADMINISTRATION', 'Administration', 'General administration'),
        ]
        
        departments_created = 0
        for code, name, description in departments_data:
            dept, created = Department.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': description,
                    'active': True,
                }
            )
            if created:
                departments_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Created {departments_created} master departments')
        )
        
        # Step 5: Create OrgUnitDepartment mappings for National HQ
        self.stdout.write('  → Creating org-unit-department mappings for National HQ...')
        mappings_created = 0
        for dept in Department.objects.filter(active=True):
            mapping, created = OrgUnitDepartment.objects.get_or_create(
                org_unit=national_hq,
                department=dept,
                defaults={
                    'mailbox_address': f'{dept.code.lower()}@nat-hq.pms.local',
                    'active': True,
                }
            )
            if created:
                mappings_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Created {mappings_created} org-unit-department mappings')
        )
        
        # Step 6: Create SystemConfig to track setup progress
        config, created = SystemConfig.objects.get_or_create(
            pk=1,
            defaults={
                'national_hq': national_hq,
                'setup_status': 'IN_PROGRESS',
            }
        )
        self.stdout.write(
            self.style.SUCCESS('  ✓ SystemConfig initialized')
        )

    @transaction.atomic
    def backfill_ownership_data(self):
        """Backfill owner_org_unit fields on domain models from existing station data"""
        self.stdout.write('\n█ Backfilling ownership data...')
        
        # Get the default organization unit (first station, or National HQ fallback)
        default_org = OrgUnit.objects.filter(unit_type='STATION').first()
        if not default_org:
            default_org = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
        
        if not default_org:
            raise CommandError('No organization units found. Run --create-hierarchy first.')
        
        # Backfill Reception.Inmate
        inmates_updated = Inmate.objects.filter(owner_org_unit__isnull=True).update(
            owner_org_unit=default_org
        )
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {inmates_updated} Inmate records')
        )
        
        # Backfill Health.Patient
        patients_updated = Patient.objects.filter(owner_org_unit__isnull=True).update(
            owner_org_unit=default_org
        )
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {patients_updated} Patient records')
        )
        
        # Backfill Health.AdmissionHealthAssessment
        assessments_updated = AdmissionHealthAssessment.objects.filter(
            owner_org_unit__isnull=True
        ).update(owner_org_unit=default_org)
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {assessments_updated} AdmissionHealthAssessment records')
        )
        
        # Backfill Stores.StockReceipt
        receipts_updated = StockReceipt.objects.filter(
            receiving_org_unit__isnull=True
        ).update(receiving_org_unit=default_org)
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {receipts_updated} StockReceipt records')
        )
        
        # Backfill Stores.FeedingSession
        feeding_updated = FeedingSession.objects.filter(
            providing_org_unit__isnull=True,
            consuming_org_unit__isnull=True
        ).update(providing_org_unit=default_org, consuming_org_unit=default_org)
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {feeding_updated} FeedingSession records')
        )
        
        # Backfill Farms.FarmProject
        projects_updated = FarmProject.objects.filter(
            owner_org_unit__isnull=True
        ).update(owner_org_unit=default_org)
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {projects_updated} FarmProject records')
        )
        
        # Backfill HumanResources.OfficerStationHistory
        postings_updated = OfficerStationHistory.objects.filter(
            posting_org_unit__isnull=True
        ).update(posting_org_unit=default_org)
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Backfilled {postings_updated} OfficerStationHistory records')
        )

    @transaction.atomic
    def create_initial_assignments(self):
        """Create initial UserAssignments for existing Django users"""
        self.stdout.write('\n█ Creating initial user assignments...')
        
        # Get or create a default department (Reception)
        reception_dept = Department.objects.get(code='RECEPTION')
        
        # Get default org unit
        default_org = OrgUnit.objects.filter(unit_type='STATION').first()
        if not default_org:
            default_org = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
        
        if not default_org:
            raise CommandError('No organization units found.')
        
        # Get ADMIN_OFFICER role (or create if missing)
        admin_role, _ = Role.objects.get_or_create(
            code='ADMIN_OFFICER',
            defaults={
                'name': 'Administrative Officer',
                'description': 'Administrative access',
                'is_active': True,
            }
        )
        
        assignments_created = 0
        for user in User.objects.filter(is_active=True):
            # Check if user already has an assignment
            if UserAssignment.objects.filter(user=user).exists():
                continue
            
            assignment = UserAssignment.objects.create(
                user=user,
                role=admin_role,
                org_unit=default_org,
                department=reception_dept,
                is_primary=True,
                is_active=True,
            )
            assignments_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'  ✓ Created {assignments_created} initial user assignments')
        )

    def _confirm(self, message):
        """Ask user for confirmation"""
        response = input(f'{message} [y/N]: ').lower().strip()
        return response in ['y', 'yes']
