"""
DRF Permission Classes for Role-Based Access Control
====================================================
Backend enforcement of role-based permissions.
Frontend restrictions are NOT sufficient - backend is the final authority.
"""

from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from .utils import normalize_role_code


# ==================================================
# BASE ROLE PERMISSION
# ==================================================
class HasRole(BasePermission):
    """
    Base permission class that checks if user has one of the required roles.
    Subclass this to create specific role permissions.
    """
    required_roles = []

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        assignment = None
        try:
            from .utils import get_primary_assignment
            assignment = get_primary_assignment(request.user)
        except Exception:
            assignment = None

        if assignment and assignment.is_active:
            user_role_code = normalize_role_code(assignment.role.code)
        else:
            if not hasattr(request.user, 'userprofile'):
                return False
            if not request.user.userprofile.is_active:
                return False
            user_role_code = normalize_role_code(request.user.userprofile.role.code)

        return user_role_code in self.required_roles


# ==================================================
# CONCRETE ROLE PERMISSIONS
# ==================================================
class IsSuperAdmin(HasRole):
    """Only super admin access"""
    required_roles = ["SUPER_ADMIN"]


class IsAdminOfficer(HasRole):
    """Admin officers and super admins"""
    required_roles = ["ADMIN_OFFICER", "SUPER_ADMIN"]


class IsReceptionOfficer(HasRole):
    """Reception officers and admins"""
    required_roles = ["RECEPTION_OFFICER", "ADMIN_OFFICER", "SUPER_ADMIN"]


class IsHealthOfficer(HasRole):
    """Health officers and admins"""
    required_roles = ["HEALTH_OFFICER", "ADMIN_OFFICER", "SUPER_ADMIN"]


class IsStoresOfficer(HasRole):
    """Stores officers and admins"""
    required_roles = ["STORES_OFFICER", "ADMIN_OFFICER", "SUPER_ADMIN"]


class IsHROfficer(HasRole):
    """HR officers and system admins"""
    required_roles = [
        "HR_OFFICER",
        "ADMIN_OFFICER",
        "SUPER_ADMIN",
        "PROVINCIAL_SYS_ADMIN",
        "STATION_SYS_ADMIN",
    ]


class IsFarmsOfficer(HasRole):
    """Farms officers and admins"""
    required_roles = ["FARMS_OFFICER", "ADMIN_OFFICER", "SUPER_ADMIN"]


# ==================================================
# COMPOSITE PERMISSIONS
# ==================================================
class IsAdminOrReception(BasePermission):
    """Admin or Reception officers"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        from .utils import get_primary_assignment
        assignment = None
        try:
            assignment = get_primary_assignment(request.user)
        except Exception:
            assignment = None

        if assignment and assignment.is_active:
            role_code = normalize_role_code(assignment.role.code)
        else:
            if not hasattr(request.user, 'userprofile'):
                return False
            if not request.user.userprofile.is_active:
                return False
            role_code = normalize_role_code(request.user.userprofile.role.code)

        return role_code in ["ADMIN_OFFICER", "RECEPTION_OFFICER", "SUPER_ADMIN"]


class IsAdminOrHealth(BasePermission):
    """Admin or Health officers"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        from .utils import get_primary_assignment
        assignment = None
        try:
            assignment = get_primary_assignment(request.user)
        except Exception:
            assignment = None

        if assignment and assignment.is_active:
            role_code = normalize_role_code(assignment.role.code)
        else:
            if not hasattr(request.user, 'userprofile'):
                return False
            if not request.user.userprofile.is_active:
                return False
            role_code = normalize_role_code(request.user.userprofile.role.code)

        return role_code in ["ADMIN_OFFICER", "HEALTH_OFFICER", "SUPER_ADMIN"]

class IsReceptionOrHealthOrAdmin(BasePermission):
    """Admin, Reception, or Health officers"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        from .utils import get_primary_assignment
        assignment = None
        try:
            assignment = get_primary_assignment(request.user)
        except Exception:
            assignment = None

        if assignment and assignment.is_active:
            role_code = normalize_role_code(assignment.role.code)
        else:
            if not hasattr(request.user, 'userprofile'):
                return False
            if not request.user.userprofile.is_active:
                return False
            role_code = normalize_role_code(request.user.userprofile.role.code)

        return role_code in ["ADMIN_OFFICER", "RECEPTION_OFFICER", "HEALTH_OFFICER", "SUPER_ADMIN"]

class IsStationDataOwner(BasePermission):
    """
    Object-level permission to ensure the user belongs to the same org_unit
    (or has hierarchical supervisory access) that owns the data record.
    Resolves Station instances to OrgUnit instances to prevent cross-table ID collisions.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        from .utils import (
            get_user_operational_context,
            resolve_org_unit_for_station,
            get_officer_current_station,
        )
        from .models import OrgUnit, Station

        # 1. Resolve actor's organizational unit
        user_org_unit, _ = get_user_operational_context(request)
        if not user_org_unit:
            return False

        # 2. Resolve target object's OrgUnit
        target_org_unit = None
        if hasattr(obj, 'owner_org_unit') and obj.owner_org_unit:
            target_org_unit = obj.owner_org_unit
        elif getattr(obj, 'owner_org_unit_id', None):
            target_org_unit = OrgUnit.objects.filter(id=obj.owner_org_unit_id).first()
        elif hasattr(obj, 'receiving_org_unit') and obj.receiving_org_unit:
            target_org_unit = obj.receiving_org_unit
        elif hasattr(obj, 'providing_org_unit') and obj.providing_org_unit:
            target_org_unit = obj.providing_org_unit
        elif hasattr(obj, 'posting_org_unit') and obj.posting_org_unit:
            target_org_unit = obj.posting_org_unit
        elif hasattr(obj, 'station') and obj.station:
            target_org_unit = resolve_org_unit_for_station(obj.station)
        elif getattr(obj, 'station_id', None):
            st = Station.objects.filter(id=obj.station_id).first()
            if st:
                target_org_unit = resolve_org_unit_for_station(st)
        elif hasattr(obj, 'inmate') and obj.inmate:
            inmate_unit = getattr(obj.inmate, 'owner_org_unit', None)
            if inmate_unit:
                target_org_unit = inmate_unit
            elif getattr(obj.inmate, 'station', None):
                target_org_unit = resolve_org_unit_for_station(obj.inmate.station)
        elif hasattr(obj, 'officer') and obj.officer:
            officer_st = get_officer_current_station(obj.officer)
            if officer_st:
                target_org_unit = resolve_org_unit_for_station(officer_st)

        # 3. Handle unassigned records (missing organizational ownership)
        if target_org_unit is None:
            if user_org_unit.unit_type == 'NATIONAL_HQ':
                return True
            raise PermissionDenied({
                "error_code": "UNASSIGNED_RECORD_RESTRICTED",
                "message": "This record has no assigned organization unit and requires National HQ authorization to access.",
                "details": "Operational records without an explicit organizational assignment cannot be accessed by station or provincial users.",
                "resolution": "Contact National Headquarters to assign this record to the appropriate station."
            })

        # 4. Check visibility against actor's scope
        visible_org_units = getattr(request, 'visible_org_units', None)
        if visible_org_units is not None:
            if visible_org_units.filter(id=target_org_unit.id).exists():
                return True
        else:
            # Fallback direct hierarchical check if middleware did not attach visible_org_units
            if user_org_unit.unit_type == 'NATIONAL_HQ':
                return True
            if user_org_unit.unit_type == 'PROVINCIAL_HQ':
                if target_org_unit.id == user_org_unit.id or target_org_unit.parent_id == user_org_unit.id:
                    return True
            if user_org_unit.unit_type == 'STATION' and target_org_unit.id == user_org_unit.id:
                return True

        target_name = getattr(target_org_unit, 'name', f"OrgUnit #{target_org_unit.id}")
        user_name = getattr(user_org_unit, 'name', f"OrgUnit #{user_org_unit.id}")
        raise PermissionDenied({
            "error_code": "STATION_MISMATCH",
            "message": "You do not have permission to access this record.",
            "details": f"This record belongs to {target_name}. Your session is scoped to {user_name}.",
            "resolution": "If you require access, please contact the administrators or request a cross-station transfer."
        })
