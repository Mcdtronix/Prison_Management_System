"""Sign-in throttling: pauses password guessing.

Two limits, both counted from `LoginEvent`, the record of every sign-in
attempt. Counting in the database means every gunicorn worker sees the same
numbers, with no shared cache to run.

* Per account name: after `ACCOUNT_MAX_FAILURES` failures within
  `ACCOUNT_WINDOW`, sign-in under that name is paused until the oldest of
  those failures is `ACCOUNT_WINDOW` old. A successful sign-in, or an
  administrator's password reset, starts the count again.
* Per address: after `ADDRESS_MAX_FAILURES` failures from one IP address
  within `ADDRESS_WINDOW`, whatever names were tried, that address is paused.
  This stops one machine spraying a common password across many accounts.

Names are counted as typed, whether or not an account exists, so a pause
never tells an attacker which service numbers are real. A refused attempt
is logged as `locked` and does not itself extend the pause.

Limits come from settings.LOGIN_LOCKOUT.
"""
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import LoginEvent, UserSecurity

LOCKED_REASON = 'locked'

ACCOUNT = 'account'
ADDRESS = 'address'


def _limits():
    conf = getattr(settings, 'LOGIN_LOCKOUT', {})
    return (
        int(conf.get('ACCOUNT_MAX_FAILURES', 5)),
        timedelta(minutes=int(conf.get('ACCOUNT_WINDOW_MINUTES', 15))),
        int(conf.get('ADDRESS_MAX_FAILURES', 20)),
        timedelta(minutes=int(conf.get('ADDRESS_WINDOW_MINUTES', 15))),
    )


def normalize(username) -> str:
    """The form a name is counted under (service numbers are upper case)."""
    return (username or '').strip().upper()[:150]


@dataclass(frozen=True)
class Lock:
    scope: str          # ACCOUNT or ADDRESS
    retry_after: int    # seconds until sign-in is allowed again

    @property
    def minutes(self) -> int:
        return max(1, -(-self.retry_after // 60))  # round up

    def message(self) -> str:
        unit = 'minute' if self.minutes == 1 else 'minutes'
        return (f'Too many failed sign-in attempts. For your security, sign-in is paused for '
                f'{self.minutes} {unit}. If you cannot remember your sign-in details, '
                f'ask your system administrator for a reset.')


def _failures():
    return LoginEvent.objects.filter(success=False).exclude(reason=LOCKED_REASON)


def _account_counted_since(name, window_start):
    """Failures count from the later of: window start, last success, last admin password reset."""
    since = window_start
    last_success = (LoginEvent.objects.filter(username_attempted=name, success=True)
                    .order_by('-at').values_list('at', flat=True).first())
    if last_success and last_success > since:
        since = last_success
    user = get_user_model().objects.filter(username__iexact=name).first()
    if user is not None:
        reset_at = (UserSecurity.objects.filter(user=user)
                    .values_list('password_reset_at', flat=True).first())
        if reset_at and reset_at > since:
            since = reset_at
    return since


def _lock_from(times, limit, window, now) -> Optional[int]:
    """Seconds left, given failure times newest first, or None if under the limit."""
    if limit <= 0 or len(times) < limit:
        return None
    unlocks_at = times[limit - 1] + window
    remaining = int((unlocks_at - now).total_seconds()) + 1
    return remaining if remaining > 0 else None


def check(username, ip) -> Optional[Lock]:
    """The lock that applies to signing in as `username` from `ip`, if any."""
    account_max, account_window, address_max, address_window = _limits()
    now = timezone.now()

    name = normalize(username)
    if name:
        since = _account_counted_since(name, now - account_window)
        times = list(_failures().filter(username_attempted=name, at__gt=since)
                     .order_by('-at').values_list('at', flat=True)[:account_max])
        seconds = _lock_from(times, account_max, account_window, now)
        if seconds:
            return Lock(ACCOUNT, seconds)

    if ip:
        times = list(_failures().filter(ip_address=ip, at__gt=now - address_window)
                     .order_by('-at').values_list('at', flat=True)[:address_max])
        seconds = _lock_from(times, address_max, address_window, now)
        if seconds:
            return Lock(ADDRESS, seconds)
    return None


def account_lock(user) -> Optional[Lock]:
    """The account-name pause on `user`, ignoring addresses (for the admin console)."""
    lock = check(user.username, None)
    return lock if lock and lock.scope == ACCOUNT else None


def locked_response(lock: Lock):
    """HTTP 429 in the envelope the frontend already displays."""
    from rest_framework import status
    from rest_framework.response import Response

    response = Response({
        'error_code': 'LOGIN_LOCKED',
        'message': lock.message(),
        'retry_after': lock.retry_after,
    }, status=status.HTTP_429_TOO_MANY_REQUESTS)
    response['Retry-After'] = str(lock.retry_after)
    return response
