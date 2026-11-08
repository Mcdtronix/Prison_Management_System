"""Sign-in throttling (Auth/lockout.py): security audit 2026-11-08, finding H1.

Before: unlimited password guesses on /api/auth/login/ and /admin/login/.
After: 5 failures per account name or 20 per address within 15 minutes
pause sign-in, everywhere a password is checked.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from Auth.lockout import check
from Auth.models import LoginEvent, UserSecurity
from Auth.sessions import client_ip

User = get_user_model()
LOGIN = '/api/auth/login/'
PASSWORD = 'Correct-Horse-42'
SMALL_ADDRESS_LIMIT = {'ACCOUNT_MAX_FAILURES': 5, 'ACCOUNT_WINDOW_MINUTES': 15,
                       'ADDRESS_MAX_FAILURES': 3, 'ADDRESS_WINDOW_MINUTES': 15}


class LockoutTestBase(TestCase):
    def setUp(self):
        # Superuser: sign-in also needs a role or station, which is not what these tests are about.
        self.user = User.objects.create_superuser(username='1300001A', password=PASSWORD)
        self.client = APIClient()

    def login(self, username='1300001A', password=PASSWORD, **extra):
        return self.client.post(LOGIN, {'username': username, 'password': password}, format='json', **extra)

    def fail(self, times, username='1300001A', **extra):
        for _ in range(times):
            self.assertEqual(self.login(username, 'wrong-password', **extra).status_code, 401)

    def age_failures(self, minutes):
        """Pretend every counted failure happened `minutes` earlier."""
        for event in LoginEvent.objects.filter(success=False).exclude(reason='locked'):
            LoginEvent.objects.filter(pk=event.pk).update(at=event.at - timedelta(minutes=minutes))


class AccountLockoutTests(LockoutTestBase):
    def test_five_failures_pause_the_account(self):
        self.fail(5)
        response = self.login()  # even the correct password is refused while paused
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()['error_code'], 'LOGIN_LOCKED')
        self.assertIn('paused for 15 minutes', response.json()['message'])
        self.assertGreater(int(response['Retry-After']), 14 * 60)
        self.assertNotIn('access', response.json())

    def test_under_the_limit_sign_in_works_and_resets_the_count(self):
        self.fail(4)
        self.assertEqual(self.login().status_code, 200)
        self.fail(4)
        self.assertEqual(self.login().status_code, 200)

    def test_pause_ends_after_the_window(self):
        self.fail(5)
        self.assertEqual(self.login().status_code, 429)
        self.age_failures(16)
        self.assertEqual(self.login().status_code, 200)

    def test_refused_attempts_do_not_extend_the_pause(self):
        self.fail(5)
        for _ in range(10):
            self.assertEqual(self.login().status_code, 429)
        self.assertEqual(LoginEvent.objects.filter(reason='locked').count(), 10)
        self.age_failures(16)  # only the real failures age; refused attempts stay recent
        self.assertEqual(self.login().status_code, 200)

    def test_admin_password_reset_lifts_the_pause(self):
        self.fail(5)
        security = UserSecurity.for_user(self.user)
        security.password_reset_at = timezone.now()
        security.save()
        self.assertEqual(self.login().status_code, 200)

    def test_unknown_names_are_paused_alike(self):
        """A pause must not reveal which service numbers have accounts."""
        self.fail(5, username='1399999Z')
        real = self.login('1300001A', 'wrong-password')
        self.fail(4)
        ghost = self.login('1399999Z', 'anything')
        self.assertEqual(ghost.status_code, 429)
        self.assertEqual(real.status_code, 401)
        self.assertEqual(ghost.json()['message'].split('.')[0], 'Too many failed sign-in attempts')

    def test_names_are_counted_case_insensitively(self):
        self.fail(3, username='1300001a')
        self.fail(2, username=' 1300001A ')
        self.assertEqual(self.login().status_code, 429)

    def test_console_shows_the_pause(self):
        from Auth.views_console import password_info
        self.assertEqual(password_info(self.user)['locked_for_seconds'], 0)
        self.fail(5)
        self.assertGreater(password_info(self.user)['locked_for_seconds'], 14 * 60)


@override_settings(LOGIN_LOCKOUT=SMALL_ADDRESS_LIMIT)
class AddressLockoutTests(LockoutTestBase):
    def test_spraying_many_names_from_one_address_is_paused(self):
        for name in ('1300101A', '1300102A', '1300103A'):
            self.fail(1, username=name)
        response = self.login()  # a fresh, valid account from the same address
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()['error_code'], 'LOGIN_LOCKED')

    def test_other_addresses_are_unaffected(self):
        for name in ('1300101A', '1300102A', '1300103A'):
            self.fail(1, username=name, REMOTE_ADDR='10.0.0.5')
        self.assertEqual(self.login(REMOTE_ADDR='10.0.0.6').status_code, 200)

    def test_forged_forwarded_for_does_not_dodge_the_limit(self):
        for i, name in enumerate(('1300101A', '1300102A', '1300103A')):
            self.fail(1, username=name, HTTP_X_FORWARDED_FOR=f'203.0.113.{i}')
        self.assertEqual(self.login(HTTP_X_FORWARDED_FOR='198.51.100.9').status_code, 429)


# The admin page needs collected static files; plain storage avoids the manifest in tests.
# The admin is off by default when DEBUG=False (CI); these tests switch it on.
@override_settings(ROOT_URLCONF='Core.urls_admin_on', STORAGES={
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
})
class AdminLoginLockoutTests(TestCase):
    """The Django admin checks passwords through the same backend."""

    def setUp(self):
        self.staff = User.objects.create_user(username='1300201A', password=PASSWORD, is_staff=True,
                                              is_superuser=True)

    def admin_login(self, password):
        self.client.post('/admin/login/', {'username': '1300201A', 'password': password,
                                           'next': '/admin/'})
        return '_auth_user_id' in self.client.session

    def test_admin_failures_are_recorded_and_pause_the_account(self):
        for _ in range(5):
            self.assertFalse(self.admin_login('wrong-password'))
        self.assertEqual(LoginEvent.objects.filter(username_attempted='1300201A', success=False,
                                                   reason='bad_credentials').count(), 5)
        self.assertFalse(self.admin_login(PASSWORD))  # correct password refused while paused
        self.assertTrue(LoginEvent.objects.filter(username_attempted='1300201A', reason='locked').exists())

    def test_admin_success_is_recorded(self):
        self.assertTrue(self.admin_login(PASSWORD))
        self.assertTrue(LoginEvent.objects.filter(username_attempted='1300201A', success=True).exists())

    def test_api_and_admin_share_one_count(self):
        api = APIClient()
        for _ in range(5):
            api.post(LOGIN, {'username': '1300201A', 'password': 'wrong'}, format='json')
        self.assertFalse(self.admin_login(PASSWORD))


class ChangePasswordLockoutTests(LockoutTestBase):
    def test_guessing_the_current_password_is_throttled(self):
        self.client.force_authenticate(self.user)
        for _ in range(5):
            response = self.client.post('/api/auth/change-password/', {
                'current_password': 'guess', 'new_password': 'Another-Strong-Pass-9'}, format='json')
            self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/auth/change-password/', {
            'current_password': PASSWORD, 'new_password': 'Another-Strong-Pass-9'}, format='json')
        self.assertEqual(response.status_code, 429)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))


class ClientIpTests(TestCase):
    def request(self, **meta):
        return RequestFactory().get('/', **meta)

    @override_settings(CLIENT_IP_HEADER='HTTP_X_REAL_IP')
    def test_trusted_header_is_used_and_forwarded_for_ignored(self):
        request = self.request(HTTP_X_REAL_IP='41.57.1.10', HTTP_X_FORWARDED_FOR='1.2.3.4',
                               REMOTE_ADDR='')
        self.assertEqual(client_ip(request), '41.57.1.10')

    @override_settings(CLIENT_IP_HEADER='')
    def test_without_a_proxy_the_peer_address_is_used(self):
        request = self.request(HTTP_X_FORWARDED_FOR='1.2.3.4', REMOTE_ADDR='10.1.1.1')
        self.assertEqual(client_ip(request), '10.1.1.1')

    @override_settings(CLIENT_IP_HEADER='HTTP_X_REAL_IP')
    def test_garbage_is_ignored(self):
        request = self.request(HTTP_X_REAL_IP="1.1.1.1'; DROP TABLE x;--", REMOTE_ADDR='10.1.1.1')
        self.assertEqual(client_ip(request), '10.1.1.1')

    def test_check_with_no_name_or_address_is_never_locked(self):
        self.assertIsNone(check('', None))
