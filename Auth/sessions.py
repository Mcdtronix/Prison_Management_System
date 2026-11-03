"""Signed-in sessions: start, touch, revoke, and who is online.

Each login creates a `UserSession`; its id is put in the JWT as `sid`.
Requests carrying a revoked session are refused (see `Auth/authentication.py`).
"""
from datetime import timedelta

from django.utils import timezone

from .models import LoginEvent, UserSecurity, UserSession

# A user counts as online if one of their sessions was used this recently.
ONLINE_WINDOW = timedelta(minutes=5)
# How often a session's last-seen time is written (keeps writes cheap).
TOUCH_INTERVAL = timedelta(seconds=60)


def client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')
    return ip or None


def user_agent(request):
    return (request.META.get('HTTP_USER_AGENT', '') if request is not None else '')[:255]


def start_session(user, request=None, org_unit=None):
    return UserSession.objects.create(
        user=user, org_unit=org_unit, ip_address=client_ip(request), user_agent=user_agent(request),
    )


def touch(session_id):
    """Record activity on a session, at most once per TOUCH_INTERVAL."""
    now = timezone.now()
    UserSession.objects.filter(pk=session_id, last_seen_at__lt=now - TOUCH_INTERVAL).update(last_seen_at=now)


def online_sessions():
    return UserSession.objects.filter(revoked_at__isnull=True, last_seen_at__gte=timezone.now() - ONLINE_WINDOW)


def revoke_sessions(user, by=None, reason='', keep=None):
    """End every open session of `user` (except `keep`) and blacklist their refresh tokens."""
    from .utils import revoke_user_tokens

    qs = UserSession.objects.filter(user=user, revoked_at__isnull=True)
    if keep is not None:
        qs = qs.exclude(pk=keep)
    count = qs.update(revoked_at=timezone.now(), revoked_by=by, revoke_reason=reason[:255])
    if keep is None:
        revoke_user_tokens(user)
    return count


def record_login(request, username, user=None, success=False, reason=''):
    LoginEvent.objects.create(
        user=user, username_attempted=(username or '')[:150], success=success, reason=reason[:100],
        ip_address=client_ip(request), user_agent=user_agent(request),
    )
    if user is None:
        return
    security = UserSecurity.for_user(user)
    if success:
        if security.failed_login_count:
            security.failed_login_count = 0
            security.save(update_fields=['failed_login_count', 'updated_at'])
    else:
        security.failed_login_count += 1
        security.last_failed_login_at = timezone.now()
        security.save(update_fields=['failed_login_count', 'last_failed_login_at', 'updated_at'])
