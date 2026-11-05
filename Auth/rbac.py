"""The permission engine: the one place that decides who may do what, where.

Capabilities live in the `auth_role_capability` table (defaults in
`Auth/capabilities.py`). An active `UserAssignment` grants its role's
capabilities at its org unit and every unit below it.

Admin tiers come from where an admin role is held:

    National HQ = 3, Provincial HQ = 2, Station = 1, any operational role = 0

Two rules protect the hierarchy (plan §2.2):

* Scope: an admin acts only on their own unit and the units below it.
* Grant: an admin may grant only roles strictly below their own tier, and
  never changes their own assignments. National admins are created by a
  break-glass superuser (two-person approval comes in Phase 6).
"""
from typing import Optional, Set

from .capabilities import DEFAULT_ROLE_CAPABILITIES, SYSTEM_ADMIN_LIMITS
from .models import OrgUnit, Role, UserAssignment
from .utils import normalize_role_code

# Kept for older imports; the database table is the source of truth.
ROLE_CAPABILITIES = DEFAULT_ROLE_CAPABILITIES

TIER_NATIONAL = 3
TIER_PROVINCIAL = 2
TIER_STATION = 1
TIER_OPERATIONAL = 0

LEVEL_TIERS = {
    'NATIONAL_HQ': TIER_NATIONAL,
    'PROVINCIAL_HQ': TIER_PROVINCIAL,
    'STATION': TIER_STATION,
}


# ---------------------------------------------------------------- helpers

def _authenticated(user) -> bool:
    return bool(user) and getattr(user, 'is_authenticated', False) and getattr(user, 'is_active', True)


def _assignments(user):
    """Active assignments whose role and org unit are both active."""
    return list(
        UserAssignment.objects.filter(user=user, is_active=True, role__is_active=True, org_unit__active=True)
        .select_related('role', 'org_unit', 'org_unit__parent', 'org_unit__parent__parent')
        .prefetch_related('role__capabilities')
    )


def role_capabilities(role) -> Set[str]:
    return {c.capability for c in role.capabilities.all()}


def assignment_capabilities(assignment) -> Set[str]:
    caps = role_capabilities(assignment.role)
    if '*' in caps and assignment.org_unit.unit_type != 'NATIONAL_HQ':
        # An all-powerful role held below National HQ acts as a unit admin.
        caps = set(DEFAULT_ROLE_CAPABILITIES['ADMIN_OFFICER'])
    return caps


def _has(caps: Set[str], capability: str) -> bool:
    return '*' in caps or capability in caps


def role_tier_at(role, org_unit) -> int:
    """The tier `role` would confer if held at `org_unit`."""
    if not role.is_admin_role or org_unit is None:
        return TIER_OPERATIONAL
    return LEVEL_TIERS.get(org_unit.unit_type, TIER_OPERATIONAL)


def assignment_tier(assignment) -> int:
    return role_tier_at(assignment.role, assignment.org_unit)


def is_ancestor(ancestor, org) -> bool:
    """True if `ancestor` is strictly above `org`."""
    cur = org.parent if org is not None else None
    while cur is not None:
        if cur.pk == ancestor.pk:
            return True
        cur = cur.parent
    return False


def covers(assignment_org, target_org) -> bool:
    """True if a grant at `assignment_org` reaches `target_org`."""
    if assignment_org is None or target_org is None:
        return False
    return assignment_org.pk == target_org.pk or is_ancestor(assignment_org, target_org)


# Older name, still imported in places.
_org_in_scope = covers


def descendant_ids(org_ids) -> Set[int]:
    """The given org units plus everything below them."""
    result = set(org_ids)
    frontier = set(org_ids)
    while frontier:
        children = set(OrgUnit.objects.filter(parent_id__in=frontier).values_list('id', flat=True)) - result
        result |= children
        frontier = children
    return result


def _legacy_capabilities(user) -> Set[str]:
    """Capabilities of a user who only has an old-style UserProfile."""
    profile = getattr(user, 'userprofile', None)
    if profile is None or not profile.is_active or not profile.role.is_active:
        return set()
    caps = role_capabilities(profile.role)
    if not caps:
        caps = set(DEFAULT_ROLE_CAPABILITIES.get(normalize_role_code(profile.role.code), []))
    caps.discard('*')  # legacy accounts never get unlimited power
    return caps


# ---------------------------------------------------------------- public API

def can(user, capability: str, target_org=None, strict: bool = False) -> bool:
    """May `user` use `capability` at `target_org`?

    With no target org: by default any assignment holding the capability is
    enough (module-level checks such as "is a health officer"). With
    `strict=True` the user must hold it at National HQ, i.e. everywhere.
    """
    if not _authenticated(user):
        return False
    if user.is_superuser:
        return True

    assignments = _assignments(user)
    for a in assignments:
        if not _has(assignment_capabilities(a), capability):
            continue
        if target_org is None:
            if not strict or a.org_unit.unit_type == 'NATIONAL_HQ':
                return True
        elif covers(a.org_unit, target_org):
            return True

    if not assignments and target_org is None and not strict:
        try:
            return _has(_legacy_capabilities(user), capability)
        except Exception:
            return False
    return False


def user_has_capability(user, capability: str, target_org=None) -> bool:
    """Older name for `can`."""
    return can(user, capability, target_org)


def is_national_admin(user) -> bool:
    """Superuser, or an admin role held at National HQ."""
    if not _authenticated(user):
        return False
    if user.is_superuser:
        return True
    return any(assignment_tier(a) == TIER_NATIONAL for a in _assignments(user))


def admin_tier(user) -> int:
    """The highest admin tier `user` holds anywhere."""
    if not _authenticated(user):
        return TIER_OPERATIONAL
    if user.is_superuser:
        return TIER_NATIONAL + 1
    return max((assignment_tier(a) for a in _assignments(user)), default=TIER_OPERATIONAL)


def admin_scope(user, capability: str) -> Optional[Set[int]]:
    """Org unit ids where `user` holds `capability`.

    None means every unit; an empty set means none.
    """
    if not _authenticated(user):
        return set()
    if user.is_superuser:
        return None
    roots = []
    for a in _assignments(user):
        if _has(assignment_capabilities(a), capability):
            if a.org_unit.unit_type == 'NATIONAL_HQ':
                return None
            roots.append(a.org_unit_id)
    return descendant_ids(roots) if roots else set()


def can_grant(actor, role, org_unit, target_user=None) -> Optional[str]:
    """None if `actor` may give `role` at `org_unit`, otherwise the reason."""
    if not _authenticated(actor):
        return 'Authentication required.'
    if role is None or org_unit is None:
        return 'A role and an org unit are required.'
    if target_user is not None and target_user.pk == actor.pk and not actor.is_superuser:
        return 'You cannot change your own role assignments.'
    if not role.is_active:
        return 'This role is disabled.'
    if role.assignable_at and role.assignable_at != org_unit.unit_type:
        return f'{role.code} can only be assigned at {role.get_assignable_at_display()} level.'
    if actor.is_superuser:
        return None

    wanted = role_tier_at(role, org_unit)
    for a in _assignments(actor):
        if not _has(assignment_capabilities(a), 'assignments.manage'):
            continue
        if covers(a.org_unit, org_unit) and wanted < assignment_tier(a):
            return None
    if wanted >= TIER_NATIONAL:
        return 'National administrators can only be appointed by a break-glass superuser.'
    return 'You can only grant roles below your own level, within your own unit or the units under it.'


def system_admin_slots(role, org_unit, exclude_user=None):
    """(used, limit) for a capped system-admin role at `org_unit`; limit is None if uncapped.

    Only active assignments of active accounts use a slot, so disabling an
    account or revoking its assignment frees one.
    """
    limit = SYSTEM_ADMIN_LIMITS.get(role.code) if role is not None else None
    if limit is None or org_unit is None:
        return 0, None
    held = UserAssignment.objects.filter(role=role, org_unit=org_unit, is_active=True, user__is_active=True)
    if exclude_user is not None:
        held = held.exclude(user=exclude_user)
    return held.values('user').distinct().count(), limit


def system_admin_slot_problem(role, org_unit, exclude_user=None) -> Optional[str]:
    """None if another `role` holder fits at `org_unit`, otherwise the reason."""
    used, limit = system_admin_slots(role, org_unit, exclude_user)
    if limit is not None and used >= limit:
        return (f'{org_unit.name} already has {used} active {role.name}s (the limit is {limit}). '
                'Disable one before adding another.')
    return None


def grantable_roles(actor, org_unit):
    """Roles `actor` may assign at `org_unit` (drives validation and UI dropdowns)."""
    return [r for r in Role.objects.filter(is_active=True) if can_grant(actor, r, org_unit) is None]


def can_manage_user(actor, target_user) -> Optional[str]:
    """None if `actor` may manage `target_user`'s account, otherwise the reason.

    The actor must be able to grant every active role the target holds, so
    nobody can disable, reset or edit someone at or above their own level.
    """
    if not _authenticated(actor):
        return 'Authentication required.'
    if target_user.pk == actor.pk:
        return 'You cannot perform this action on your own account.'
    if actor.is_superuser:
        return None
    if target_user.is_superuser:
        return 'Break-glass accounts can only be managed by another superuser.'
    held = UserAssignment.objects.filter(user=target_user, is_active=True).select_related('role', 'org_unit')
    if not held:
        return None if is_national_admin(actor) else 'This user has no assignment in your area.'
    for a in held:
        reason = can_grant(actor, a.role, a.org_unit)
        if reason:
            return f'{target_user.username} holds {a.role.code} at {a.org_unit.code}, which you do not control.'
    return None
