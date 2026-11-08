"""Authentication backend with sign-in throttling.

Every password check goes through `django.contrib.auth.authenticate`: the
API login (Simple JWT), the Django admin login, and anything added later.
Putting the lock here means none of them can skip it.
"""
from django.contrib.auth.backends import ModelBackend
from django.core.exceptions import PermissionDenied

from . import lockout
from .sessions import client_ip


class LockoutModelBackend(ModelBackend):
    """Django's ModelBackend, refusing while a sign-in pause is active.

    Raising PermissionDenied (rather than returning None) stops Django trying
    any other backend, and still sends `user_login_failed`, so the refused
    attempt is logged. The password is not checked while locked, so a correct
    guess during a pause tells the attacker nothing.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(self._username_field())
        lock = lockout.check(username, client_ip(request))
        if lock is not None:
            if request is not None:
                request.login_lock = lock
            raise PermissionDenied(lock.message())
        return super().authenticate(request, username=username, password=password, **kwargs)

    @staticmethod
    def _username_field():
        from django.contrib.auth import get_user_model
        return get_user_model().USERNAME_FIELD
