"""
Django Admin Configuration for RBAC
====================================
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Role, Station, UserProfile, AuditLog


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
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete audit logs
        return request.user.is_superuser
