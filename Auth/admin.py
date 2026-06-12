"""
Django Admin Configuration for RBAC
====================================
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.urls import path
from django.shortcuts import redirect
from django.contrib import messages
from .models import (
    Role,
    Station,
    UserProfile,
    AuditLog,
    OrgUnit,
    Department,
    OrgUnitDepartment,
    UserAssignment,
    DataExposurePolicy,
    DataExposureRecord,
    SystemConfig,
)
from django.urls import reverse
from django.utils.html import format_html


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'location', 'active', 'created_at']
    list_filter = ['active', 'created_at']
    search_fields = ['code', 'name', 'location']
    readonly_fields = ['created_at', 'updated_at']


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fk_name = 'user'
    autocomplete_fields = ['officer', 'role', 'station']


class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    
    def get_inline_instances(self, request, obj=None):
        if not obj:
            return list()
        return super().get_inline_instances(request, obj)


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'officer', 'role', 'station', 'is_active', 'created_at']
    list_filter = ['role', 'station', 'is_active', 'created_at']
    search_fields = [
        'user__username',
        'user__email',
        'officer__service_number',
        'officer__first_name',
        'officer__surname',
        'role__code',
        'station__code',
    ]
    readonly_fields = ['created_at', 'updated_at']
    autocomplete_fields = ['user', 'officer', 'role', 'station']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'station', 'action', 'module', 'timestamp', 'ip_address']
    list_filter = ['module', 'role', 'station', 'timestamp']
    search_fields = ['user__username', 'action', 'object_id']
    readonly_fields = [
        'user', 'role', 'station', 'action', 'module', 'object_id', 'object_type',
        'ip_address', 'user_agent', 'request_method', 'request_path',
        'remarks', 'timestamp'
    ]
    date_hierarchy = 'timestamp'
    actions = ['export_selected_csv']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete audit logs
        return request.user.is_superuser

    def export_selected_csv(self, request, queryset):
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_selected.csv"'
        writer = csv.writer(response)
        writer.writerow(['timestamp', 'user', 'role', 'station', 'action', 'module', 'object_type', 'object_id', 'ip', 'path', 'remarks'])
        for a in queryset:
            writer.writerow([
                a.timestamp.isoformat(),
                a.user.username if a.user else '',
                a.role,
                a.station.code if a.station else '',
                a.action,
                a.module,
                a.object_type or '',
                a.object_id or '',
                a.ip_address or '',
                a.request_path or '',
                (a.remarks or '').replace('\n',' '),
            ])
        return response

    export_selected_csv.short_description = 'Export selected audit logs to CSV'


@admin.register(OrgUnit)
class OrgUnitAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'unit_type', 'parent', 'active', 'created_at']
    list_filter = ['unit_type', 'active']
    search_fields = ['code', 'name', 'code_short']
    readonly_fields = ['created_at', 'updated_at']
    autocomplete_fields = ['parent']
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('<int:pk>/create-child/', self.admin_site.admin_view(self.create_child_view), name='auth_orgunit_create_child'),
            path('<int:pk>/create-admin/', self.admin_site.admin_view(self.create_admin_view), name='auth_orgunit_create_admin'),
            path('<int:pk>/create-department/', self.admin_site.admin_view(self.create_department_view), name='auth_orgunit_create_department'),
        ]
        return custom + urls

    def create_child_view(self, request, pk):
        from django.shortcuts import render
        from .forms_admin import CreateOrgUnitForm
        parent = OrgUnit.objects.get(pk=pk)

        if request.method == 'POST':
            form = CreateOrgUnitForm(request.POST)
            if form.is_valid():
                data = form.cleaned_data
                child = OrgUnit.objects.create(
                    name=data['name'],
                    code=data['code'],
                    code_short=data['code_short'],
                    unit_type=data['unit_type'],
                    parent=parent,
                    location=data.get('location',''),
                    description=data.get('description',''),
                )
                from .utils import create_audit_log
                create_audit_log(request.user, action='CREATE_ORGUNIT', module='RBAC', object_type='OrgUnit', object_id=child.pk, remarks=f'Created {child.code} under {parent.code}', role=getattr(request.user, 'username', None), station=None)
                self.message_user(request, f'Created {child.code} successfully.', level=messages.SUCCESS)
                return redirect('..')
        else:
            form = CreateOrgUnitForm(initial={'unit_type': 'PROVINCIAL_HQ' if parent.unit_type == 'NATIONAL_HQ' else 'STATION'})

        context = dict(self.admin_site.each_context(request))
        context.update({'form': form, 'parent': parent, 'opts': self.model._meta})
        return render(request, 'admin/auth/create_child.html', context)

    def create_admin_view(self, request, pk):
        from django.shortcuts import render
        from .forms_admin import CreateAdminUserForm
        parent = OrgUnit.objects.get(pk=pk)

        if request.method == 'POST':
            form = CreateAdminUserForm(request.POST)
            if form.is_valid():
                data = form.cleaned_data
                officer = data['officer']
                role = data['role']
                password = data['password']
                email = data.get('email','')

                # Create Django user and assignment
                user = User.objects.create_user(username=officer.service_number, email=email, password=password, first_name=officer.first_name, last_name=officer.surname)
                # Attach UserAssignment
                ua = UserAssignment.objects.create(user=user, role=role, org_unit=parent, department=Department.objects.first() or Department.objects.create(code='ADMIN', name='Administration'))
                ua.is_primary = True
                ua.save()

                from .utils import create_audit_log
                create_audit_log(request.user, action='CREATE_ADMIN_ACCOUNT', module='RBAC', object_type='User', object_id=user.pk, remarks=f'Created admin {user.username} for {parent.code}', role=getattr(request.user, 'username', None), station=None)
                self.message_user(request, f'Created admin {user.username} successfully.', level=messages.SUCCESS)
                return redirect('..')
        else:
            form = CreateAdminUserForm()

        context = dict(self.admin_site.each_context(request))
        context.update({'form': form, 'orgunit': parent, 'opts': self.model._meta})
        return render(request, 'admin/auth/create_admin.html', context)

    def create_department_view(self, request, pk):
        from django.shortcuts import render
        from .forms_admin import CreateDepartmentAccountForm
        org = OrgUnit.objects.get(pk=pk)

        if request.method == 'POST':
            form = CreateDepartmentAccountForm(request.POST)
            if form.is_valid():
                data = form.cleaned_data
                dept = data['department']
                # create OrgUnitDepartment
                oud, created = OrgUnitDepartment.objects.get_or_create(org_unit=org, department=dept)
                if created:
                    oud.save()
                # optionally create a user for that department
                if data.get('create_user') and data.get('officer') and data.get('role'):
                    officer = data['officer']
                    role = data['role']
                    user = User.objects.create_user(username=officer.service_number, email=officer.email or '', password='ChangeMe123!')
                    ua = UserAssignment.objects.create(user=user, role=role, org_unit=org, department=dept, is_primary=True)
                    ua.save()
                    from .utils import create_audit_log
                    create_audit_log(request.user, action='CREATE_DEPARTMENT_ACCOUNT', module='RBAC', object_type='User', object_id=user.pk, remarks=f'Created dept account {user.username} for {org.code}/{dept.code}', role=getattr(request.user, 'username', None), station=None)

                self.message_user(request, f'Department {dept.code} configured for {org.code}.', level=messages.SUCCESS)
                return redirect('..')
        else:
            form = CreateDepartmentAccountForm()

        context = dict(self.admin_site.each_context(request))
        context.update({'form': form, 'orgunit': org, 'opts': self.model._meta})
        return render(request, 'admin/auth/create_department.html', context)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'active', 'created_at']
    list_filter = ['active']
    search_fields = ['code', 'name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(OrgUnitDepartment)
class OrgUnitDepartmentAdmin(admin.ModelAdmin):
    list_display = ['mailbox_address', 'org_unit', 'department', 'active', 'created_at']
    list_filter = ['active', 'org_unit', 'department']
    search_fields = ['mailbox_address', 'org_unit__code', 'department__code']
    autocomplete_fields = ['org_unit', 'department']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['create_missing_mailboxes']

    def create_missing_mailboxes(self, request, queryset):
        """Admin action to ensure Messaging.Mailbox records exist for selected OrgUnitDepartment rows."""
        created = 0
        from django.db import IntegrityError
        try:
            from Messaging.models import Mailbox as MessagingMailbox
        except Exception:
            self.message_user(request, 'Messaging app not installed or import failed.', level='warning')
            return

        for oud in queryset:
            if hasattr(oud, 'mailbox') and oud.mailbox:
                # already linked via OneToOne
                continue
            address = getattr(oud, 'mailbox_address', None)
            if not address:
                continue
            try:
                MessagingMailbox.objects.create(org_unit_department=oud, mailbox_address=address)
                created += 1
            except IntegrityError:
                # race or already exists
                continue

        self.message_user(request, f'Created {created} mailbox records.')

    create_missing_mailboxes.short_description = 'Create/sync Messaging.Mailbox for selected departments'
    
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('sync-mailboxes/', self.admin_site.admin_view(self.sync_mailboxes_view), name='auth_orgunitdepartment_sync_mailboxes'),
        ]
        return custom + urls

    def sync_mailboxes_view(self, request):
        """Admin view to sync all OrgUnitDepartment rows to Messaging.Mailbox."""
        try:
            from Messaging.models import Mailbox as MessagingMailbox
        except Exception:
            self.message_user(request, 'Messaging app not available.', level=messages.WARNING)
            return redirect('..')

        created = 0
        for oud in OrgUnitDepartment.objects.all():
            addr = getattr(oud, 'mailbox_address', None)
            if not addr:
                continue
            if hasattr(oud, 'mailbox') and oud.mailbox:
                continue
            try:
                MessagingMailbox.objects.create(org_unit_department=oud, mailbox_address=addr)
                created += 1
            except Exception:
                continue

        self.message_user(request, f'Synced mailboxes: created {created}', level=messages.INFO)
        return redirect('..')


@admin.register(UserAssignment)
class UserAssignmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'org_unit', 'department', 'is_primary', 'is_active', 'created_at']
    list_filter = ['is_primary', 'is_active', 'role', 'org_unit', 'department']
    search_fields = ['user__username', 'role__code', 'org_unit__code', 'department__code']
    autocomplete_fields = ['user', 'role', 'org_unit', 'department', 'created_by', 'revoked_by']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(DataExposurePolicy)
class DataExposurePolicyAdmin(admin.ModelAdmin):
    list_display = ['code', 'source_org_unit', 'target_org_unit', 'module', 'visibility_level', 'status', 'effective_from']
    list_filter = ['module', 'visibility_level', 'status', 'source_org_unit', 'target_org_unit']
    search_fields = ['code', 'description']
    autocomplete_fields = ['source_org_unit', 'target_org_unit', 'approved_by', 'revoked_by', 'created_by']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(DataExposureRecord)
class DataExposureRecordAdmin(admin.ModelAdmin):
    list_display = ['resource_type', 'resource_id', 'target_org_unit', 'policy', 'exposed_at', 'revoked_at']
    list_filter = ['resource_type', 'target_org_unit', 'revoked_at']
    search_fields = ['resource_id', 'policy__code']
    autocomplete_fields = ['policy', 'target_org_unit', 'exposed_by', 'revoked_by']
    readonly_fields = ['exposed_at']


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ['setup_status', 'national_hq', 'setup_sealed_by', 'setup_sealed_at', 'created_at']
    list_filter = ['setup_status']
    search_fields = ['national_hq__code', 'setup_sealed_reason']
    autocomplete_fields = ['national_hq', 'setup_sealed_by']
    readonly_fields = ['created_at', 'updated_at']
