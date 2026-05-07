"""
Management command to initialize RBAC system
============================================
Creates default roles and stations for the Prison Management System.

Usage:
    python manage.py init_rbac
"""

from django.core.management.base import BaseCommand
from Auth.models import Role, Station


class Command(BaseCommand):
    help = 'Initialize RBAC system with default roles and stations'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Initializing RBAC system...'))
        
        # Create default roles
        roles_data = [
            {
                'code': 'SUPER_ADMIN',
                'name': 'Super Administrator',
                'description': 'Full system access across all stations'
            },
            {
                'code': 'ADMIN_OFFICER',
                'name': 'Administrative Officer',
                'description': 'Administrative access to assigned station'
            },
            {
                'code': 'RECEPTION_OFFICER',
                'name': 'Reception Officer',
                'description': 'Inmate registration and reception management'
            },
            {
                'code': 'HEALTH_OFFICER',
                'name': 'Health Officer',
                'description': 'Health records and medical services management'
            },
            {
                'code': 'STORES_OFFICER',
                'name': 'Stores Officer',
                'description': 'Inventory and stores management'
            },
            {
                'code': 'FARMS_OFFICER',
                'name': 'Farms Officer',
                'description': 'Agricultural production management'
            },
        ]
        
        roles_created = 0
        roles_updated = 0
        
        for role_data in roles_data:
            role, created = Role.objects.get_or_create(
                code=role_data['code'],
                defaults={
                    'name': role_data['name'],
                    'description': role_data['description'],
                    'is_active': True
                }
            )
            
            if created:
                roles_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Created role: {role.code} - {role.name}')
                )
            else:
                # Update existing role if name or description changed
                updated = False
                if role.name != role_data['name']:
                    role.name = role_data['name']
                    updated = True
                if role.description != role_data['description']:
                    role.description = role_data['description']
                    updated = True
                if not role.is_active:
                    role.is_active = True
                    updated = True
                
                if updated:
                    role.save()
                    roles_updated += 1
                    self.stdout.write(
                        self.style.WARNING(f'  ↻ Updated role: {role.code} - {role.name}')
                    )
                else:
                    self.stdout.write(
                        self.style.SUCCESS(f'  → Role already exists: {role.code} - {role.name}')
                    )
        
        # Create example stations (you can modify these)
        stations_data = [
            {
                'code': 'CHIKURUBI',
                'name': 'Chikurubi Maximum Security Prison',
                'location': 'Harare'
            },
            {
                'code': 'HARARE',
                'name': 'Harare Remand Prison',
                'location': 'Harare'
            },
            {
                'code': 'BULAWAYO',
                'name': 'Bulawayo Prison',
                'location': 'Bulawayo'
            },
            {
                'code': 'GWERU',
                'name': 'Gweru Prison',
                'location': 'Gweru'
            },
        ]
        
        stations_created = 0
        
        for station_data in stations_data:
            station, created = Station.objects.get_or_create(
                code=station_data['code'],
                defaults={
                    'name': station_data['name'],
                    'location': station_data['location'],
                    'active': True
                }
            )
            
            if created:
                stations_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Created station: {station.code} - {station.name}')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'  → Station already exists: {station.code} - {station.name}')
                )
        
        self.stdout.write(self.style.SUCCESS('\nRBAC initialization complete!'))
        self.stdout.write(f'  Roles created: {roles_created}')
        self.stdout.write(f'  Roles updated: {roles_updated}')
        self.stdout.write(f'  Stations created: {stations_created}')
        self.stdout.write(self.style.WARNING('\nNext steps:'))
        self.stdout.write('  1. Create a superuser: python manage.py createsuperuser')
        self.stdout.write('  2. Assign role and station to user in Django admin')
        self.stdout.write('  3. Create additional stations as needed')

