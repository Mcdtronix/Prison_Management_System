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
    
    try:
        profile = request.user.userprofile
    except AttributeError:
        # User doesn't have a profile - log with minimal info
        return AuditLog.objects.create(
            user=request.user,
            role="UNKNOWN",
            station=None,
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
    
    return AuditLog.objects.create(
        user=request.user,
        role=normalize_role_code(profile.role.code),
        station=profile.station,
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

