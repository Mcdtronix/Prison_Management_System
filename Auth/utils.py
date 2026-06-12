from .models import AuditLog
from .middleware import get_current_request


def create_audit_log(actor, action, module='AUTH', object_type=None, object_id=None, remarks=None, role=None, station=None):
    """Convenience helper to create an AuditLog entry enriched with request metadata.

    Use this helper from admin actions, role-assignment helpers, and view code paths.
    """
    req = get_current_request()
    ip = None
    ua = None
    path = None
    method = None
    if req is not None:
        ip = req.META.get('REMOTE_ADDR') or req.META.get('HTTP_X_FORWARDED_FOR')
        ua = req.META.get('HTTP_USER_AGENT', '')
        path = req.path
        method = req.method

    AuditLog.objects.create(
        user=actor or None,
        role=role or (getattr(actor, 'username', 'system') if actor else 'system'),
        station=station,
        action=action,
        module=module,
        object_type=object_type,
        object_id=str(object_id) if object_id is not None else None,
        ip_address=ip or '0.0.0.0',
        user_agent=ua,
        request_method=method,
        request_path=path,
        remarks=remarks,
    )
"""
Audit Logging Utility
=====================
Centralized audit logging for all sensitive actions.
"""

from django.utils import timezone

from .models import AuditLog


def normalize_role_code(role_code):
    """
    Convert stored role labels/abbreviations into canonical role codes.
    Supports legacy dotted role codes such as R.O and A.O.
    """
    if not role_code:
        return ""

    normalized = (
        str(role_code)
        .strip()
        .upper()
        .replace(".", "_")
        .replace("-", "_")
        .replace(" ", "_")
    )
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    normalized = normalized.strip("_")

    aliases = {
        "SUPERADMIN": "SUPER_ADMIN",
        "SUPER_ADMIN": "SUPER_ADMIN",
        "ADMIN": "ADMIN_OFFICER",
        "ADMIN_OFFICER": "ADMIN_OFFICER",
        "A_O": "ADMIN_OFFICER",
        "AO": "ADMIN_OFFICER",
        "RECEPTION": "RECEPTION_OFFICER",
        "RECEPTION_OFFICER": "RECEPTION_OFFICER",
        "R_O": "RECEPTION_OFFICER",
        "RO": "RECEPTION_OFFICER",
        "HEALTH": "HEALTH_OFFICER",
        "HEALTH_OFFICER": "HEALTH_OFFICER",
        "H_O": "HEALTH_OFFICER",
        "HO": "HEALTH_OFFICER",
        "STORES": "STORES_OFFICER",
        "STORES_OFFICER": "STORES_OFFICER",
        "S_O": "STORES_OFFICER",
        "SO": "STORES_OFFICER",
        "FARMS": "FARMS_OFFICER",
        "FARMS_OFFICER": "FARMS_OFFICER",
        "F_O": "FARMS_OFFICER",
        "FO": "FARMS_OFFICER",
    }

    return aliases.get(normalized, normalized)


def get_primary_assignment(user):
    """
    Return the active primary UserAssignment for the user, if any.
    """
    try:
        return user.org_assignments.select_related('org_unit', 'department', 'role').filter(
            is_active=True,
            is_primary=True
        ).first()
    except Exception:
        return None


def get_current_role_code(user):
    """
    Return the canonical role code for the user.
    """
    assignment = get_primary_assignment(user)
    if assignment and assignment.role:
        return normalize_role_code(assignment.role.code)

    try:
        profile = user.userprofile
    except AttributeError:
        return ""

    return normalize_role_code(getattr(profile.role, 'code', ''))


def get_current_org_unit(user):
    """
    Return the user's primary org unit, if assigned.
    """
    assignment = get_primary_assignment(user)
    if assignment and assignment.org_unit:
        return assignment.org_unit
    return None


def get_current_department(user):
    """
    Return the user's primary department, if assigned.
    """
    assignment = get_primary_assignment(user)
    if assignment and assignment.department:
        return assignment.department
    return None


def log_action(request, action, module, object_id=None, object_type=None, remarks=None):
    """
    Log an action to the audit trail.
    
    Args:
        request: Django request object (must have authenticated user)
        action: Description of the action (e.g., "Created inmate record")
        module: Module code (e.g., "INMATES", "HEALTH")
        object_id: ID of the affected object (optional)
        object_type: Type of object (optional, e.g., "Inmate", "MedicineIssue")
        remarks: Additional notes (optional)
    
    Returns:
        AuditLog instance
    """
    if not request.user.is_authenticated:
        return None

    role_code = get_current_role_code(request.user)
    station = None

    try:
        profile = request.user.userprofile
        station = profile.station
    except AttributeError:
        pass

    return AuditLog.objects.create(
        user=request.user,
        role=role_code or "UNKNOWN",
        station=station,
        action=action,
        module=module,
        object_id=object_id,
        object_type=object_type,
        ip_address=_get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        request_method=request.method,
        request_path=request.path,
        remarks=remarks
    )


def get_current_station(user):
    """
    Get the current station for a user.

    Args:
        user: Django User instance

    Returns:
        Station instance or None
    """
    try:
        return user.userprofile.station
    except AttributeError:
        return None


def get_officer_current_station(officer):
    """
    Resolve an officer's current station from station history.
    """
    today = timezone.now().date()

    current_assignment = officer.station_history.filter(
        date_posted__lte=today,
        date_transferred__isnull=True,
    ).order_by("-date_posted").first()

    if current_assignment:
        return current_assignment.station

    latest_assignment = officer.station_history.order_by("-date_posted").first()
    if latest_assignment:
        return latest_assignment.station

    return None


def _get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

