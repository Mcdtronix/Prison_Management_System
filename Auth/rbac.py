"""Central RBAC utilities and role→capability mapping.

This module defines a simple capability map and helper functions to
check whether a user (via their `UserAssignment`) has permission to
perform an action within an `OrgUnit` scope.

Design notes:
- Mapping uses role codes to list capabilities. A role may have `*`
  to allow all actions.
- Assignments grant capabilities at the assigned `org_unit` and all
  descendant org units (provincial→station inheritance).
"""
from typing import List
from Auth.models import UserAssignment

# Role -> capabilities mapping. Extend as Phase 2 grows.
ROLE_CAPABILITIES = {
    # Full system access
    'SUPER_ADMIN': ['*'],

    # Administrative roles (manage users, orgs, policies, and cross-module ops)
    'ADMIN_OFFICER': [
        # Cases
        'cases.create', 'cases.view', 'cases.change', 'cases.delete', 'cases.manage_exposure',
        # Users/Assignments
        'users.create', 'users.view', 'users.change', 'users.delete', 'assignments.manage',
        # Exposure policies
        'policies.create', 'policies.view', 'policies.approve', 'policies.revoke',
        # Admin management capabilities
        'admin.create_phq', 'admin.assign_phq_admin', 'admin.manage_phq_departments',
        'admin.create_station', 'admin.assign_station_admin', 'admin.manage_station_departments',
        'admin.assign_roles', 'admin.assign_officer', 'admin.view_created_logs', 'admin.view_password_changes',
    ],

    # Reception officers: manage inmate and case intake
    'RECEPTION_OFFICER': [
        'reception.create', 'reception.view',
        'cases.create', 'cases.view',
    ],

    # Health officers: view and manage health records and related cases
    'HEALTH_OFFICER': [
        'health.create', 'health.view', 'health.change',
        'cases.view',
    ],

    # Stores/logistics: view inventory and link receipts to cases
    'STORES_OFFICER': [
        'stores.view', 'stores.create', 'stores.change',
        'cases.view',
    ],

    # Farms: view/manage farm logs (may relate to cases via evidence chain)
    'FARMS_OFFICER': [
        'farms.view', 'farms.create', 'farms.change',
    ],

    # HR: manage officer records and HR-related actions
    'HR_OFFICER': [
        'hr.view', 'hr.create', 'hr.change', 'hr.delete',
        'assignments.manage',
    ],

    # Auditors: read-only across modules for reporting
    'AUDITOR': [
        'reception.view', 'health.view', 'stores.view', 'farms.view', 'cases.view', 'users.view',
        'reports.export',
    ],
}


def _org_in_scope(assignment_org, target_org) -> bool:
    """Return True if `assignment_org` covers `target_org` (same or ancestor)."""
    if assignment_org is None or target_org is None:
        return False
    if assignment_org.pk == target_org.pk:
        return True
    # Walk up from target_org to root checking for assignment_org
    cur = target_org
    while cur.parent is not None:
        if cur.parent.pk == assignment_org.pk:
            return True
        cur = cur.parent
    return False


def user_has_capability(user, capability: str, target_org=None) -> bool:
    """Return True if `user` has `capability` for `target_org`.

    - superuser bypass
    - checks active UserAssignment rows for matching role capabilities
    - supports '*' wildcard capability
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_superuser:
        return True

    assignments = UserAssignment.objects.filter(user=user, is_active=True)
    for a in assignments:
        caps: List[str] = ROLE_CAPABILITIES.get(a.role.code, [])
        if '*' in caps or capability in caps:
            # If no target_org provided, role capability is sufficient
            if target_org is None:
                return True
            if _org_in_scope(a.org_unit, target_org):
                return True
    return False
