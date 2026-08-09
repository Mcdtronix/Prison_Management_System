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
    that owns the data record.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        user_org_unit = None
        if hasattr(request, 'org_unit') and request.org_unit:
            user_org_unit = request.org_unit
        else:
            try:
                from .utils import get_primary_assignment
                assignment = get_primary_assignment(request.user)
                if assignment and assignment.is_active:
                    user_org_unit = assignment.org_unit
            except Exception:
                pass
            
            if not user_org_unit and hasattr(request.user, 'userprofile') and request.user.userprofile.is_active:
                user_org_unit = request.user.userprofile.station

        if not user_org_unit:
            return False

        # Determine the object's organization unit
        # In Reception module, this is usually owner_org_unit_id
        # In other modules, it might be station_id
        obj_org_id = getattr(obj, 'owner_org_unit_id', getattr(obj, 'station_id', None))
        
        # If the object is not tied to any org unit, we can allow access or deny by default.
        # Assuming we allow access to global objects if they don't have an owner.
        if obj_org_id is None:
            return True
            
        if obj_org_id != user_org_unit.id:
            raise PermissionDenied({
                "error_code": "STATION_MISMATCH",
                "message": "You do not have permission to access this record.",
                "details": f"This record belongs to another organization unit. Your current session is locked to {user_org_unit.name}.",
                "resolution": "If you require access, please contact the administrators."
            })
            
        return True
