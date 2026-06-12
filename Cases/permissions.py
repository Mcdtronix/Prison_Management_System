from rest_framework import permissions

from Auth.rbac import user_has_capability


class CasesRBACPermission(permissions.BasePermission):
    """Permission class using central RBAC capability checks for Cases.

    - Read (SAFE_METHODS) is allowed to authenticated users.
    - Unsafe methods require `cases.create` / `cases.change` / `cases.delete`
      capability depending on HTTP method and the `request.org_unit` scope.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        # Determine capability required
        if request.method == 'POST':
            cap = 'cases.create'
        elif request.method in ('PUT', 'PATCH'):
            cap = 'cases.change'
        elif request.method == 'DELETE':
            cap = 'cases.delete'
        else:
            cap = None

        if cap is None:
            return False

        target_org = getattr(request, 'org_unit', None)
        return user_has_capability(request.user, cap, target_org)
