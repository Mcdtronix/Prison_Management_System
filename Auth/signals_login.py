"""Records sign-ins that do not go through the API login view (e.g. the Django admin).

The API login view records its own attempts, with richer reasons, and marks
the request `login_recorded` so nothing is logged twice. Everything else that
calls `authenticate()` is recorded here, which is what lets the sign-in
throttle (Auth/lockout.py) count Django admin attempts too.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver

from . import lockout
from .sessions import record_login


@receiver(user_login_failed, dispatch_uid='pms_record_failed_sign_in')
def record_failed_sign_in(sender, credentials, request=None, **kwargs):
    if request is None or getattr(request, 'login_recorded', False):
        return
    User = get_user_model()
    name = lockout.normalize(credentials.get(User.USERNAME_FIELD) or credentials.get('username'))
    known = User.objects.filter(username__iexact=name).first() if name else None
    if getattr(request, 'login_lock', None) is not None:
        reason = lockout.LOCKED_REASON
    elif known is not None and not known.is_active:
        reason = 'inactive'
    else:
        reason = 'bad_credentials'
    record_login(request, name, user=known, success=False, reason=reason)


@receiver(user_logged_in, dispatch_uid='pms_record_session_sign_in')
def record_session_sign_in(sender, request, user, **kwargs):
    # Only session sign-ins (the Django admin) send this; the API login does not.
    if request is None or getattr(request, 'login_recorded', False):
        return
    record_login(request, lockout.normalize(user.get_username()), user=user, success=True, reason='session')
