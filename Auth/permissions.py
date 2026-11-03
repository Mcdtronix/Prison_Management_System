"""
DRF permission classes
======================
Every class here asks the permission engine (`Auth/rbac.py`); none checks
role names. The backend is the final authority: the frontend only hides
buttons.

The older class names are kept so existing views keep working. Each now
maps to a capability that the same roles hold, so behaviour is unchanged,
but access can be adjusted per role in the `auth_role_capability` table.
"""

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .rbac import can, covers, is_national_admin


class Capability(BasePermission):
    """Allow the request if the user holds any of `capabilities`.

    Use `Capability.of('health.access')` in `permission_classes`.
    """
    capabilities = ()

    @classmethod
    def of(cls, *capabilities):
        return type(f"Capability_{'_'.join(c.replace('.', '_') for c in capabilities)}",
                    (cls,), {'capabilities': capabilities})

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return any(can(user, c) for c in self.capabilities)


class IsSuperAdmin(BasePermission):
    """National-tier administrators (and break-glass superusers)."""

    def has_permission(self, request, view):
        return is_national_admin(request.user)


class IsSuperAdminOrReadOnly(BasePermission):
    """Any signed-in user may read; only national admins with `roles.manage` may change."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return can(request.user, 'roles.manage', strict=True)


# Older names, now capability-based.
IsAdminOfficer = Capability.of('reception.approve')        # station approvals (admission, discharge…)
CanManageUsers = Capability.of('users.manage')             # account management screens
IsReceptionOfficer = Capability.of('reception.access')
IsHealthOfficer = Capability.of('health.access')
IsStoresOfficer = Capability.of('stores.access')
IsFarmsOfficer = Capability.of('farms.access')
IsAdminOrReception = IsReceptionOfficer
IsAdminOrHealth = IsHealthOfficer
IsReceptionOrHealthOrAdmin = Capability.of('reception.access', 'health.access')


class IsStationDataOwner(BasePermission):
    """Object-level check: the record must belong to the user's org unit or one below it.

    Compares org units with org units (`owner_org_unit`) and legacy stations
    with legacy stations (`station`). Records with neither are allowed for
    now; Phase 1b gives every record an owner.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True

        owner = getattr(obj, 'owner_org_unit', None)
        if owner is None and self._station_is_org_unit(obj):
            owner = obj.station  # some models already point `station` at an OrgUnit
        if owner is not None:
            from .rbac import _assignments
            if any(covers(a.org_unit, owner) for a in _assignments(user)):
                return True
            return self._deny(request)

        station_id = getattr(obj, 'station_id', None)
        if station_id is not None:
            profile = getattr(user, 'userprofile', None)
            if profile is not None and profile.is_active and profile.station_id == station_id:
                return True
            if is_national_admin(user):
                return True
            return self._deny(request)

        return True

    @staticmethod
    def _station_is_org_unit(obj):
        from .models import OrgUnit
        try:
            field = obj._meta.get_field('station')
        except Exception:
            return False
        return field.is_relation and field.related_model is OrgUnit and obj.station_id is not None

    @staticmethod
    def _deny(request):
        unit = getattr(request, 'org_unit', None)
        raise PermissionDenied({
            "error_code": "STATION_MISMATCH",
            "message": "You do not have permission to access this record.",
            "details": "This record belongs to another organization unit."
                       + (f" Your current session is locked to {unit.name}." if unit else ""),
            "resolution": "If you require access, please contact the administrators.",
        })
