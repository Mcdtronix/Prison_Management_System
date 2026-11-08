"""Security audit 2026-11-08: M1 (unsafe defaults), M3 (exposed back-office
pages) and M4 (one-time passwords never expired, now 30 minutes).
"""
import importlib
import os
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import clear_url_caches
from django.utils import timezone
from rest_framework.test import APIClient

from Auth.models import LoginEvent, UserSecurity

User = get_user_model()
BASE_DIR = Path(settings.BASE_DIR)
PLAIN_STATIC = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
STRONG_KEY = 'x7Hq2vLm9Rt4Kp8Wz3Nc6Bd1Fg5Js0YuAeQiOoXrTlMnVbCsDh'  # 51 random characters


# --------------------------------------------------------------------- M1

class SafeDefaultsTests(SimpleTestCase):
    """Settings are loaded in a fresh process, as a server would load them."""

    def start(self, **env):
        clean = {k: v for k, v in os.environ.items() if k not in ('DEBUG', 'SECRET_KEY')}
        clean.update(env)
        code = ("import django, os; os.environ['DJANGO_SETTINGS_MODULE']='Core.settings'; django.setup(); "
                "from django.conf import settings; print('DEBUG', settings.DEBUG)")
        return subprocess.run([sys.executable, '-c', code], cwd=BASE_DIR, env=clean,
                              capture_output=True, text=True, timeout=120)

    def test_production_refuses_to_start_without_a_real_key(self):
        for key in ('', 'your-secret-key-here-change-in-production', 'django-insecure-' + 'a' * 60,
                    'a' * 60):
            with self.subTest(key=key[:20]):
                result = self.start(DEBUG='False', SECRET_KEY=key)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('SECRET_KEY is missing, a placeholder, or too weak', result.stderr)

    def test_production_starts_with_a_strong_key(self):
        result = self.start(DEBUG='False', SECRET_KEY=STRONG_KEY)
        self.assertEqual(result.returncode, 0, result.stderr[-500:])
        self.assertIn('DEBUG False', result.stdout)


# --------------------------------------------------------------------- M3

def load_urls(**overrides):
    """Rebuild Core.urls as a server would with these settings."""
    with override_settings(**overrides):
        import Core.urls
        importlib.reload(Core.urls)
        clear_url_caches()
        return [str(p.pattern) for p in Core.urls.urlpatterns]


class BackOfficePagesTests(TestCase):
    def tearDown(self):
        load_urls()  # put the normal URLs back for other tests
        super().tearDown()

    def test_production_has_no_admin_or_api_docs_by_default(self):
        patterns = load_urls(DEBUG=False, ADMIN_ENABLED=False, API_DOCS_ENABLED=False)
        self.assertNotIn('admin/', patterns)
        self.assertNotIn('swagger/', patterns)
        self.assertEqual(self.client.get('/admin/login/').status_code, 404)
        self.assertEqual(self.client.get('/swagger/').status_code, 404)

    @override_settings(STORAGES=PLAIN_STATIC)
    def test_api_docs_enabled_in_production_are_staff_only(self):
        patterns = load_urls(DEBUG=False, API_DOCS_ENABLED=True)
        self.assertIn('swagger/', patterns)
        self.assertIn(self.client.get('/swagger.json').status_code, (401, 403))
        staff = User.objects.create_user('1400001A', password='unused-pass-1234', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get('/swagger.json').status_code, 200)


@override_settings(ROOT_URLCONF='Core.urls_admin_on', STORAGES=PLAIN_STATIC, CLIENT_IP_HEADER='')
class AdminAddressTests(TestCase):
    @override_settings(ADMIN_ALLOWED_IPS=['10.0.0.0/8', '41.57.1.10'])
    def test_admin_only_from_listed_addresses(self):
        self.assertEqual(self.client.get('/admin/login/', REMOTE_ADDR='10.20.30.40').status_code, 200)
        self.assertEqual(self.client.get('/admin/login/', REMOTE_ADDR='41.57.1.10').status_code, 200)
        self.assertEqual(self.client.get('/admin/login/', REMOTE_ADDR='196.4.80.9').status_code, 404)

    @override_settings(ADMIN_ALLOWED_IPS=['10.0.0.0/8'])
    def test_forged_forwarded_for_does_not_get_in(self):
        response = self.client.get('/admin/login/', REMOTE_ADDR='196.4.80.9', HTTP_X_FORWARDED_FOR='10.0.0.1')
        self.assertEqual(response.status_code, 404)

    @override_settings(ADMIN_ALLOWED_IPS=[])
    def test_empty_list_allows_any_address(self):
        self.assertEqual(self.client.get('/admin/login/', REMOTE_ADDR='196.4.80.9').status_code, 200)

    def test_rest_of_the_site_is_not_affected(self):
        with override_settings(ADMIN_ALLOWED_IPS=['10.0.0.0/8']):
            self.assertEqual(self.client.get('/api/ping/', REMOTE_ADDR='196.4.80.9').status_code, 200)


@override_settings(STORAGES=PLAIN_STATIC)
class ReleaseChecksTests(TestCase):
    """scripts/deploy/deploy.sh runs this before a release receives traffic."""

    def test_reports_schema_static_and_back_office_settings(self):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        with override_settings(ADMIN_ENABLED=False, API_DOCS_ENABLED=False):
            call_command('release_checks', stdout=out)
        text = out.getvalue()
        self.assertRegex(text, r'API schema builds \(\d+ paths\)')
        self.assertIn('Static manifest resolves', text)
        self.assertIn('admin_enabled=False', text)


# --------------------------------------------------------------------- M4

class OneTimePasswordExpiryTests(TestCase):
    PASSWORD = 'Issued-By-Admin-7Q'

    def setUp(self):
        # Superuser: sign-in also needs a role or station, which is not what these tests are about.
        self.user = User.objects.create_superuser('1400101A', password=self.PASSWORD)
        self.api = APIClient()

    def issue(self, minutes_ago):
        """An administrator issued the one-time password `minutes_ago` minutes ago."""
        UserSecurity.objects.update_or_create(user=self.user, defaults={
            'must_change_password': True, 'password_reset_at': timezone.now() - timedelta(minutes=minutes_ago)})

    def login(self):
        return self.api.post('/api/auth/login/', {'username': '1400101A', 'password': self.PASSWORD}, format='json')

    def test_works_within_30_minutes(self):
        self.issue(minutes_ago=29)
        self.assertEqual(self.login().status_code, 200)

    def test_refused_after_30_minutes(self):
        self.issue(minutes_ago=31)
        response = self.login()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error_code'], 'TEMP_PASSWORD_EXPIRED')
        self.assertIn('valid for 30 minutes', response.json()['message'])
        self.assertNotIn('access', response.json())
        self.assertTrue(LoginEvent.objects.filter(username_attempted='1400101A',
                                                  reason='temp_password_expired').exists())

    def test_wrong_password_still_gets_the_generic_answer(self):
        """The expiry message only follows the correct password, so it reveals nothing."""
        self.issue(minutes_ago=31)
        response = self.api.post('/api/auth/login/', {'username': '1400101A', 'password': 'guess'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_session_opened_with_it_ends_at_the_deadline(self):
        self.issue(minutes_ago=10)
        access = self.login().json()['access']
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(self.api.get('/api/auth/me/').status_code, 200)
        self.issue(minutes_ago=31)  # time passes without a new password being chosen
        response = self.api.get('/api/auth/me/')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error_code'], 'TEMP_PASSWORD_EXPIRED')
        change = self.api.post('/api/auth/change-password/', {
            'current_password': self.PASSWORD, 'new_password': 'Own-Strong-Pass-55'}, format='json')
        self.assertEqual(change.status_code, 401)

    def test_choosing_a_password_in_time_ends_the_clock(self):
        self.issue(minutes_ago=10)
        access = self.login().json()['access']
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.api.post('/api/auth/change-password/', {
            'current_password': self.PASSWORD, 'new_password': 'Own-Strong-Pass-55'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        UserSecurity.objects.filter(user=self.user).update(password_reset_at=timezone.now() - timedelta(days=3))
        self.api.credentials()
        response = self.api.post('/api/auth/login/', {'username': '1400101A', 'password': 'Own-Strong-Pass-55'},
                                 format='json')
        self.assertEqual(response.status_code, 200)

    @override_settings(TEMP_PASSWORD_TTL_MINUTES=5)
    def test_lifetime_is_configurable(self):
        self.issue(minutes_ago=6)
        self.assertEqual(self.login().status_code, 403)

    @override_settings(ROOT_URLCONF='Core.urls_admin_on', STORAGES=PLAIN_STATIC)
    def test_django_admin_refuses_it_too(self):
        self.issue(minutes_ago=31)
        self.client.post('/admin/login/', {'username': '1400101A', 'password': self.PASSWORD, 'next': '/admin/'})
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_console_shows_the_deadline(self):
        from Auth.views_console import password_info
        self.issue(minutes_ago=10)
        deadline = password_info(self.user)['temporary_expires_at']
        self.assertAlmostEqual((deadline - timezone.now()).total_seconds(), 20 * 60, delta=5)
