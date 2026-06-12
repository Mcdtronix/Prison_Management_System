# Generated migration for Phase 1: Organizational Hierarchy, User Assignments, and Data Exposure Policies
# This migration creates the foundation for multi-tenant, multi-organization system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0002_userprofile_officer'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ==================================================
        # Create OrgUnit (hierarchical organizational model)
        # ==================================================
        migrations.CreateModel(
            name='OrgUnit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, help_text='Unique identifier (NAT_HQ_001, HARARE_PROV, CHIVHU_STN)', max_length=50, unique=True)),
                ('name', models.CharField(help_text='Display name (National Headquarters, Harare Province, Chivhu Station)', max_length=150, unique=True)),
                ('code_short', models.CharField(help_text='Short code for UI (NAT_HQ, HARARE, CHV)', max_length=20, db_index=True)),
                ('unit_type', models.CharField(choices=[('NATIONAL_HQ', 'National Headquarters'), ('PROVINCIAL_HQ', 'Provincial Command Center'), ('STATION', 'Prison Station')], db_index=True, help_text='Organizational level in hierarchy', max_length=20)),
                ('location', models.CharField(blank=True, help_text='Physical location/address', max_length=200, null=True)),
                ('description', models.TextField(blank=True, help_text='Operational notes', null=True)),
                ('active', models.BooleanField(db_index=True, default=True, help_text='Active in system (soft-delete via this field)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('parent', models.ForeignKey(blank=True, help_text='Parent organization (National for provinces, Province for stations)', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='children', to='Auth.orgunit', db_index=True)),
            ],
            options={
                'verbose_name': 'Organizational Unit',
                'verbose_name_plural': 'Organizational Units',
                'db_table': 'auth_org_unit',
                'ordering': ['code'],
            },
        ),

        # ==================================================
        # Create Department (master list)
        # ==================================================
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, help_text='Unique code (RECEPTION, HEALTH, STORES, FARMS, etc.)', max_length=50, unique=True)),
                ('name', models.CharField(help_text='Display name (Reception/Admissions, Health/Medical, etc.)', max_length=100, unique=True)),
                ('description', models.TextField(blank=True, help_text="Department responsibilities & scope", null=True)),
                ('active', models.BooleanField(db_index=True, default=True, help_text='Active department')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Department',
                'verbose_name_plural': 'Departments',
                'db_table': 'auth_department',
                'ordering': ['code'],
            },
        ),

        # ==================================================
        # Create OrgUnitDepartment (mapping)
        # ==================================================
        migrations.CreateModel(
            name='OrgUnitDepartment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mailbox_address', models.EmailField(help_text='Unique mailbox email (e.g., reception@chivhu or health@harare-prov)', max_length=254, unique=True)),
                ('active', models.BooleanField(db_index=True, default=True, help_text='Active department at this org unit')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(help_text='Department (Reception, Health, etc.)', on_delete=django.db.models.deletion.PROTECT, related_name='org_units', to='Auth.department')),
                ('org_unit', models.ForeignKey(help_text='Organization (National/Provincial/Station)', on_delete=django.db.models.deletion.CASCADE, related_name='departments', to='Auth.orgunit')),
            ],
            options={
                'verbose_name': 'Organizational Unit Department',
                'verbose_name_plural': 'Organizational Unit Departments',
                'db_table': 'auth_org_unit_department',
                'unique_together': {('org_unit', 'department')},
            },
        ),

        # ==================================================
        # Create UserAssignment (multi-tenant user binding)
        # ==================================================
        migrations.CreateModel(
            name='UserAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_primary', models.BooleanField(db_index=True, default=False, help_text='Default assignment context for user (only one per user)')),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='False if assignment is revoked/suspended')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('revoked_at', models.DateTimeField(blank=True, help_text='When assignment was revoked', null=True)),
                ('revocation_reason', models.TextField(blank=True, help_text='Reason for revocation (audit trail)', null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, help_text='Admin who created this assignment', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_assignments', to='Auth.userassignment')),
                ('department', models.ForeignKey(db_index=True, help_text='Assigned department (Reception, Health, etc.)', on_delete=django.db.models.deletion.PROTECT, related_name='user_assignments', to='Auth.department')),
                ('org_unit', models.ForeignKey(db_index=True, help_text='Assigned organization (National/Provincial/Station)', on_delete=django.db.models.deletion.PROTECT, related_name='user_assignments', to='Auth.orgunit')),
                ('revoked_by', models.ForeignKey(blank=True, help_text='Admin who revoked this assignment', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revoked_assignments', to='Auth.userassignment')),
                ('role', models.ForeignKey(help_text='Role (RECEPTION_OFFICER, HEALTH_OFFICER, ADMIN_OFFICER, etc.)', on_delete=django.db.models.deletion.PROTECT, related_name='org_assignments', to='Auth.role')),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='org_assignments', to=settings.AUTH_USER_MODEL, help_text='Django user account')),
            ],
            options={
                'verbose_name': 'User Assignment',
                'verbose_name_plural': 'User Assignments',
                'db_table': 'auth_user_assignment',
            },
        ),

        # ==================================================
        # Create DataExposurePolicy (explicit data visibility rules)
        # ==================================================
        migrations.CreateModel(
            name='DataExposurePolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(help_text='Policy identifier (CHIVHU_INMATE_SUMMARY_TO_HARARE)', max_length=50, unique=True)),
                ('module', models.CharField(choices=[('RECEPTION', 'Inmate/Reception'), ('HEALTH', 'Health/Medical'), ('STORES', 'Stores/Logistics'), ('FARMS', 'Farms/Production'), ('HUMAN_RESOURCES', 'HR/Personnel'), ('FINANCE', 'Finance'), ('SECURITY', 'Security/Disciplinary'), ('ALL', 'All modules')], help_text='Which module/data is exposed', max_length=50)),
                ('visibility_level', models.CharField(choices=[('SUMMARY', 'Summary only (aggregated counts, statistics)'), ('DETAIL_READ_ONLY', 'Detail-level read access, no export'), ('CUSTOM', 'Custom field selection')], help_text='What level of detail is exposed', max_length=20)),
                ('custom_fields', models.JSONField(blank=True, help_text='JSON list of exposed fields ["id", "name", "status"]', null=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft (not active)'), ('PENDING_APPROVAL', 'Awaiting approval'), ('APPROVED', 'Approved and active'), ('REVOKED', 'Revoked')], db_index=True, default='DRAFT', help_text='Approval status', max_length=20)),
                ('approved_at', models.DateTimeField(blank=True, help_text='When approved', null=True)),
                ('revoked_at', models.DateTimeField(blank=True, help_text='When revoked', null=True)),
                ('revocation_reason', models.TextField(blank=True, null=True)),
                ('effective_from', models.DateTimeField(help_text='Policy becomes active')),
                ('effective_to', models.DateTimeField(blank=True, help_text='Policy expires (null = no end date)', null=True)),
                ('description', models.TextField(blank=True, help_text='Business justification for exposure', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by', models.ForeignKey(blank=True, help_text='Admin who approved policy', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_policies', to='Auth.userassignment')),
                ('created_by', models.ForeignKey(help_text='Admin who created this policy', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_policies', to='Auth.userassignment')),
                ('revoked_by', models.ForeignKey(blank=True, help_text='Admin who revoked policy', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revoked_policies', to='Auth.userassignment')),
                ('source_org_unit', models.ForeignKey(help_text='Owner of data (e.g., Chivhu Station)', on_delete=django.db.models.deletion.CASCADE, related_name='exposure_policies_from', to='Auth.orgunit')),
                ('target_org_unit', models.ForeignKey(help_text='Recipient of data (e.g., Harare Province)', on_delete=django.db.models.deletion.CASCADE, related_name='exposure_policies_to', to='Auth.orgunit')),
            ],
            options={
                'verbose_name': 'Data Exposure Policy',
                'verbose_name_plural': 'Data Exposure Policies',
                'db_table': 'auth_data_exposure_policy',
            },
        ),

        # ==================================================
        # Create DataExposureRecord (individual records exposed)
        # ==================================================
        migrations.CreateModel(
            name='DataExposureRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_type', models.CharField(choices=[('INMATE', 'Inmate'), ('PATIENT', 'Patient'), ('OFFICER', 'Officer'), ('TRANSACTION', 'Financial/Stock Transaction')], db_index=True, help_text='Type of resource exposed', max_length=50)),
                ('resource_id', models.IntegerField(db_index=True, help_text='ID of resource (inmate.id, patient.id, etc.)')),
                ('exposed_at', models.DateTimeField(auto_now_add=True, help_text='When exposed')),
                ('revoked_at', models.DateTimeField(blank=True, help_text='When exposure revoked (soft-delete)', null=True)),
                ('exposed_by', models.ForeignKey(blank=True, help_text='Admin who exposed record', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='exposed_records', to='Auth.userassignment')),
                ('policy', models.ForeignKey(help_text='Policy under which this record is exposed', on_delete=django.db.models.deletion.CASCADE, related_name='records', to='Auth.dataexposurepolicy')),
                ('revoked_by', models.ForeignKey(blank=True, help_text='Admin who revoked exposure', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revoked_records', to='Auth.userassignment')),
                ('target_org_unit', models.ForeignKey(help_text='Org unit that can see this record', on_delete=django.db.models.deletion.CASCADE, related_name='exposed_records', to='Auth.orgunit')),
            ],
            options={
                'verbose_name': 'Data Exposure Record',
                'verbose_name_plural': 'Data Exposure Records',
                'db_table': 'auth_data_exposure_record',
                'unique_together': {('resource_type', 'resource_id', 'target_org_unit')},
            },
        ),

        # ==================================================
        # Create SystemConfig (setup state singleton)
        # ==================================================
        migrations.CreateModel(
            name='SystemConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('setup_status', models.CharField(choices=[('UNINITIALIZED', 'Awaiting first setup'), ('IN_PROGRESS', 'Setup wizard in progress'), ('READY', 'Setup complete, ready for operations'), ('OPERATIONAL', 'Normal operations ongoing')], default='UNINITIALIZED', help_text='Current setup state of system', max_length=20)),
                ('setup_sealed_at', models.DateTimeField(blank=True, help_text='When setup was sealed', null=True)),
                ('setup_sealed_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('national_hq', models.OneToOneField(blank=True, help_text='Reference to National HQ org unit', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='system_config', to='Auth.orgunit')),
                ('setup_sealed_by', models.ForeignKey(blank=True, help_text='Admin who sealed setup', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sealed_configs', to='Auth.userassignment')),
            ],
            options={
                'verbose_name': 'System Configuration',
                'verbose_name_plural': 'System Configurations',
                'db_table': 'core_system_config',
            },
        ),

        # ==================================================
        # Add database indexes
        # ==================================================
        migrations.AddIndex(
            model_name='orgunit',
            index=models.Index(fields=['unit_type', 'parent', 'active'], name='auth_org_un_unit_ty_idx'),
        ),
        migrations.AddIndex(
            model_name='orgunit',
            index=models.Index(fields=['active'], name='auth_org_un_active_idx'),
        ),
        migrations.AddIndex(
            model_name='orgunit',
            index=models.Index(fields=['code'], name='auth_org_un_code_idx'),
        ),
        migrations.AddIndex(
            model_name='orgunitdepartment',
            index=models.Index(fields=['org_unit', 'active'], name='auth_org_un_org_uni_idx'),
        ),
        migrations.AddIndex(
            model_name='orgunitdepartment',
            index=models.Index(fields=['mailbox_address'], name='auth_org_un_mailbox_idx'),
        ),
        migrations.AddIndex(
            model_name='userassignment',
            index=models.Index(fields=['user', 'is_active'], name='auth_user_as_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='userassignment',
            index=models.Index(fields=['user', 'is_primary'], name='auth_user_as_user_is_idx'),
        ),
        migrations.AddIndex(
            model_name='userassignment',
            index=models.Index(fields=['org_unit', 'department', 'is_active'], name='auth_user_as_org_unit_idx'),
        ),
        migrations.AddIndex(
            model_name='userassignment',
            index=models.Index(fields=['org_unit', 'role', 'is_active'], name='auth_user_as_org_role_idx'),
        ),
        migrations.AddIndex(
            model_name='dataexposurepolicy',
            index=models.Index(fields=['source_org_unit', 'target_org_unit', 'module'], name='auth_data_ex_source_idx'),
        ),
        migrations.AddIndex(
            model_name='dataexposurepolicy',
            index=models.Index(fields=['status', 'effective_from'], name='auth_data_ex_status_idx'),
        ),
        migrations.AddIndex(
            model_name='dataexposurerecord',
            index=models.Index(fields=['resource_type', 'resource_id', 'revoked_at'], name='auth_data_ex_rec_res_idx'),
        ),

        # ==================================================
        # Add constraints
        # ==================================================
        migrations.AddConstraint(
            model_name='userassignment',
            constraint=models.UniqueConstraint(condition=models.Q(('is_primary', True), ('is_active', True)), fields=['user'], name='unique_active_primary_assignment_per_user', violation_error_message='User can have only one active primary assignment'),
        ),
    ]
