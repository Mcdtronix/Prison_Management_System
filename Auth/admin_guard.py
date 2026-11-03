"""Scope and grant rules for administrative actions.

Two rules protect the admin hierarchy:

* Scope rule: an admin acts only on their own org unit and the units below it.
* Grant rule: an admin may hand out a role only if it is below their own
  tier, or the same tier at a unit strictly below their own. Nobody changes
  their own assignments. Only super admins grant SUPER_ADMIN.
"""
from typing import Optional, Set

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import OrgUnit, UserAssignment
from .rbac import ROLE_CAPABILITIES
from .utils import normalize_role_code

TIER_SUPER = 3
TIER_ADMIN = 2
TIER_OPERATIONAL = 1

# Admin role codes created through the admin UI, mapped to the built-in
# role whose capabilities they carry. Replaced by proper roles in Phase 1.
ROLE_EQUIVALENTS = {
    'HQ_SYS_ADMIN': 'SUPER_ADMIN',
    'PROV_SYS_ADMIN': 'ADMIN_OFFICER',
    'SYS_ADMIN': 'ADMIN_OFFICER',
}

ROLE_TIERS = {
    'SUPER_ADMIN': TIER_SUPER,
    'ADMIN_OFFICER': TIER_ADMIN,
}


def canonical_role(role) -> str:
    code = normalize_role_code(getattr(role, 'code', role))
    return ROLE_EQUIVALENTS.get(code, code)


def role_tier(role) -> int:
    return ROLE_TIERS.get(canonical_role(role), TIER_OPERATIONAL)


def _assignment_tier(a) -> int:
    """Tier an assignment actually confers: super-admin power only at National HQ."""
    tier = role_tier(a.role)
    if tier == TIER_SUPER and a.org_unit.unit_type != 'NATIONAL_HQ':
        return TIER_ADMIN
    return tier


def _active_assignments(user):
    return UserAssignment.objects.filter(user=user, is_active=True).select_related('role', 'org_unit')


def is_super_admin(user) -> bool:
    """Superuser, or an active SUPER_ADMIN assignment."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_superuser:
        return True
    return any(_assignment_tier(a) == TIER_SUPER for a in _active_assignments(user))


def descendant_ids(org_ids) -> Set[int]:
    """The given org units plus everything below them."""
    result = set(org_ids)
    frontier = set(org_ids)
    while frontier:
        children = set(
            OrgUnit.objects.filter(parent_id__in=frontier).values_list('id', flat=True)
        ) - result
        result |= children
        frontier = children
    return result


def is_ancestor(ancestor, org) -> bool:
    """True if `ancestor` is strictly above `org`."""
    cur = org.parent if org is not None else None
    while cur is not None:
        if cur.pk == ancestor.pk:
            return True
        cur = cur.parent
    return False


def _covers(assignment_org, target_org) -> bool:
    return assignment_org.pk == target_org.pk or is_ancestor(assignment_org, target_org)


def _role_has(role, capability) -> bool:
    caps = ROLE_CAPABILITIES.get(canonical_role(role), ROLE_CAPABILITIES.get(role.code, []))
    if '*' in caps:
        # A super-admin role held below National HQ acts as a unit admin only.
        caps = ROLE_CAPABILITIES['ADMIN_OFFICER']
    return capability in caps


def scoped_org_ids(user, capability) -> Optional[Set[int]]:
    """Org unit ids where `user` holds `capability`.

    Returns None for "everything" (super admins) and an empty set for nothing.
    """
    if is_super_admin(user):
        return None
    roots = [a.org_unit_id for a in _active_assignments(user) if _role_has(a.role, capability)]
    return descendant_ids(roots) if roots else set()


def has_scoped_capability(user, capability, target_org) -> bool:
    """Capability check that never passes without a concrete target org."""
    if target_org is None:
        return is_super_admin(user)
    if is_super_admin(user):
        return True
    return any(
        _role_has(a.role, capability) and _covers(a.org_unit, target_org)
        for a in _active_assignments(user)
    )


def can_grant(actor, role, org_unit, target_user=None) -> Optional[str]:
    """Return None if `actor` may give `role` at `org_unit`, else the reason."""
    if not actor or not getattr(actor, 'is_authenticated', False):
        return 'Authentication required.'
    if target_user is not None and target_user.pk == actor.pk and not actor.is_superuser:
        return 'You cannot change your own role assignments.'
    if org_unit is None or role is None:
        return 'A role and an org unit are required.'
    if is_super_admin(actor):
        return None

    wanted = role_tier(role)
    if wanted >= TIER_SUPER:
        return 'Only super administrators can grant SUPER_ADMIN.'

    for a in _active_assignments(actor):
        if not _role_has(a.role, 'assignments.manage'):
            continue
        if not _covers(a.org_unit, org_unit):
            continue
        mine = _assignment_tier(a)
        if wanted < mine:
            return None
        if wanted == mine and is_ancestor(a.org_unit, org_unit):
            return None
    return 'You can only grant roles below your own level, within your own unit or the units under it.'


class IsSuperAdminOrReadOnly(BasePermission):
    """Any signed-in user may read; only super admins may change."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_super_admin(request.user)
