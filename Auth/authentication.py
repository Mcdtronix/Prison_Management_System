"""JWT authentication that also honours sessions and forced password changes."""
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserSecurity, UserSession
from .sessions import touch

# While a password change is pending, only these endpoints work.
PASSWORD_CHANGE_ALLOWED = (
    '/api/auth/me/',
    '/api/auth/change-password/',
    '/api/auth/logout/',
    '/api/auth/heartbeat/',
)


def session_is_live(sid, user_id) -> bool:
    return UserSession.objects.filter(pk=sid, user_id=user_id, revoked_at__isnull=True).exists()


class SessionJWTAuthentication(JWTAuthentication):
    """Standard JWT checks, plus:

    * the token's session (`sid`) must still be open, so force-logout works at once;
    * an account flagged `must_change_password` can only reach the change-password flow.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result

        sid = token.get('sid')
        if sid:
            if not session_is_live(sid, user.pk):
                raise AuthenticationFailed('Your session has ended. Please sign in again.', code='session_revoked')
            touch(sid)

        if not request.path.startswith(PASSWORD_CHANGE_ALLOWED):
            if UserSecurity.objects.filter(user=user, must_change_password=True).exists():
                raise PermissionDenied({
                    'error_code': 'PASSWORD_CHANGE_REQUIRED',
                    'message': 'You must set a new password before continuing.',
                })
        return user, token


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Refuses to refresh a token whose session has been revoked."""

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except TokenError:
            return super().validate(attrs)  # reports the token problem in the usual way
        sid = refresh.get('sid')
        if sid and not session_is_live(sid, refresh.get('user_id')):
            raise InvalidToken('Your session has ended. Please sign in again.')
        return super().validate(attrs)
