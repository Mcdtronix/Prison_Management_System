from rest_framework import permissions


class MessagingPermission(permissions.BasePermission):
    """Allow messaging reads to authenticated users; writes require mailbox context."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        # For posting messages, require request.mailbox to be set
        if not getattr(request, 'mailbox', None):
            return False
        return True
