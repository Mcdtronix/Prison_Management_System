"""One-time passwords issued by an administrator expire.

When the console creates an account or resets a password, it hands the
administrator a generated one-time password and flags the account
`must_change_password`. That password is good for
settings.TEMP_PASSWORD_TTL_MINUTES (30) after it was issued. After that:

* signing in with it is refused with TEMP_PASSWORD_EXPIRED (Auth/backends.py),
  so a code written down, overheard or left in a message is soon worthless;
* a session opened with it, but never used to choose a new password, ends
  (Auth/authentication.py);
* the administrator issues a new one from the console.

Once the officer chooses their own password, nothing here applies.
"""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

EXPIRED_CODE = 'TEMP_PASSWORD_EXPIRED'
EXPIRED_MESSAGE = ('Your one-time password has expired. One-time passwords are valid for '
                   '{minutes} minutes. Ask your system administrator to issue a new one.')


def ttl() -> timedelta:
    return timedelta(minutes=settings.TEMP_PASSWORD_TTL_MINUTES)


def expires_at(security):
    """When the pending one-time password expires, or None if none is pending."""
    if security is None or not security.must_change_password or security.password_reset_at is None:
        return None
    return security.password_reset_at + ttl()


def expired_for(user) -> bool:
    from .models import UserSecurity
    security = UserSecurity.objects.filter(user=user).first()
    deadline = expires_at(security)
    return deadline is not None and timezone.now() >= deadline


def expired_message() -> str:
    return EXPIRED_MESSAGE.format(minutes=settings.TEMP_PASSWORD_TTL_MINUTES)
