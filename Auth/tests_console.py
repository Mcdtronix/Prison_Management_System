"""Admin console: sessions, online status, password reset flow and scoping."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Auth.models import AuditLog, LoginEvent, OrgUnit, UserSecurity, UserSession
from Auth.testing import assign, role

User = get_user_model()
PW = 'Kx9!vTq2#mLw7pZ'


class ConsoleBase(TestCase):
    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prv = OrgUnit.objects.create(code='PRV', name='Province A', code_short='PRV', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.prb = OrgUnit.objects.create(code='PRB', name='Province B', code_short='PRB', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.sta = OrgUnit.objects.create(code='STA', name='Station A', code_short='STA', unit_type='STATION', parent=self.prv)
        self.stc = OrgUnit.objects.create(code='STC', name='Station C', code_short='STC', unit_type='STATION', parent=self.prb)
        self.hq = self.make('1000001A', 'HQ_SYS_ADMIN', self.nat)
        self.stn_admin = self.make('1000002B', 'STN_SYS_ADMIN', self.sta)
        self.clerk = self.make('1000003C', 'RECEPTION_OFFICER', self.sta)
        self.far_clerk = self.make('1000004D', 'RECEPTION_OFFICER', self.stc)

    def make(self, username, role_code, unit):
        u = User.objects.create_user(username=username, password=PW, first_name='Test', last_name=username)
        assign(u, role(role_code), unit)
        return u

    def login(self, username, password=PW):
        c = APIClient()
        r = c.post('/api/auth/login/', {'username': username, 'password': password}, format='json')
        return c, r

    def signed_in(self, user):
        c, r = self.login(user.username)
        self.assertEqual(r.status_code, 200, r.content)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        return c, r.json()


class SessionTests(ConsoleBase):
    def test_login_creates_session_and_records_event(self):
        _, data = self.signed_in(self.clerk)
        self.assertTrue(UserSession.objects.filter(user=self.clerk, revoked_at__isnull=True).exists())
        self.assertTrue(LoginEvent.objects.filter(user=self.clerk, success=True).exists())
        self.assertFalse(data['must_change_password'])

    def test_failed_login_is_recorded_and_counted(self):
        _, r = self.login(self.clerk.username, 'wrong-password')
        self.assertEqual(r.status_code, 401)
        self.assertTrue(LoginEvent.objects.filter(username_attempted=self.clerk.username, success=False).exists())
        self.assertEqual(UserSecurity.objects.get(user=self.clerk).failed_login_count, 1)

    def test_force_logout_ends_access_and_refresh(self):
        clerk_client, tokens = self.signed_in(self.clerk)
        self.assertEqual(clerk_client.get('/api/auth/me/').status_code, 200)
        hq, _ = self.signed_in(self.hq)
        r = hq.post(f'/api/auth/console/users/{self.clerk.pk}/force-logout/', {'reason': 'Lost device'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(clerk_client.get('/api/auth/me/').status_code, 401)
        r = APIClient().post('/api/auth/token/refresh/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_logout_ends_own_session(self):
        c, tokens = self.signed_in(self.clerk)
        c.post('/api/auth/logout/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(c.get('/api/auth/me/').status_code, 401)

    def test_online_list_and_heartbeat_not_audited(self):
        c, _ = self.signed_in(self.clerk)
        before = AuditLog.objects.count()
        self.assertEqual(c.post('/api/auth/heartbeat/').status_code, 204)
        self.assertEqual(AuditLog.objects.count(), before)
        hq, _ = self.signed_in(self.hq)
        names = {s['username'] for s in hq.get('/api/auth/console/online/').json()}
        self.assertIn(self.clerk.username, names)


class PasswordResetTests(ConsoleBase):
    def test_full_reset_flow(self):
        clerk_client, _ = self.signed_in(self.clerk)
        hq, _ = self.signed_in(self.hq)

        self.assertEqual(hq.post(f'/api/auth/console/users/{self.clerk.pk}/reset-password/', {'reason': 'x'},
                                 format='json').status_code, 400)  # reason required
        r = hq.post(f'/api/auth/console/users/{self.clerk.pk}/reset-password/',
                    {'reason': 'Forgot password, ID checked'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        temp = r.json()['temporary_password']
        self.assertEqual(clerk_client.get('/api/auth/me/').status_code, 401)  # old sessions ended

        c, r = self.login(self.clerk.username, temp)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['must_change_password'])
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        self.assertEqual(c.get('/api/auth/me/').status_code, 200)
        blocked = c.get('/api/auth/roles/')
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.json()['error_code'], 'PASSWORD_CHANGE_REQUIRED')

        r = c.post('/api/auth/change-password/', {'current_password': temp, 'new_password': 'Brand-New-Pass-42'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        self.assertEqual(c.get('/api/auth/roles/').status_code, 200)
        self.assertFalse(UserSecurity.objects.get(user=self.clerk).must_change_password)

        log = AuditLog.objects.filter(action='RESET_PASSWORD', object_id=str(self.clerk.pk)).first()
        self.assertIsNotNone(log)
        self.assertIn('ID checked', log.remarks)

    def test_cannot_reset_higher_or_out_of_scope(self):
        c, _ = self.signed_in(self.stn_admin)
        r = c.post(f'/api/auth/console/users/{self.hq.pk}/reset-password/', {'reason': 'trying it'}, format='json')
        self.assertIn(r.status_code, (403, 404))
        r = c.post(f'/api/auth/console/users/{self.far_clerk.pk}/reset-password/', {'reason': 'trying it'}, format='json')
        self.assertEqual(r.status_code, 404)  # not even visible
        r = c.post(f'/api/auth/console/users/{self.clerk.pk}/reset-password/', {'reason': 'Forgot password'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_cannot_reset_own_password_through_console(self):
        c, _ = self.signed_in(self.hq)
        r = c.post(f'/api/auth/console/users/{self.hq.pk}/reset-password/', {'reason': 'just me'}, format='json')
        self.assertEqual(r.status_code, 403)


class ConsoleScopeTests(ConsoleBase):
    def test_operational_users_have_no_console(self):
        c, _ = self.signed_in(self.clerk)
        self.assertEqual(c.get('/api/auth/console/overview/').status_code, 403)

    def test_hq_sees_everything_station_admin_sees_own_station(self):
        hq, _ = self.signed_in(self.hq)
        names = {u['username'] for u in hq.get('/api/auth/console/users/').json()['results']}
        self.assertTrue({self.clerk.username, self.far_clerk.username, self.hq.username} <= names)
        stn, _ = self.signed_in(self.stn_admin)
        names = {u['username'] for u in stn.get('/api/auth/console/users/').json()['results']}
        self.assertIn(self.clerk.username, names)
        self.assertNotIn(self.far_clerk.username, names)
        self.assertNotIn(self.hq.username, names)

    def test_org_tree_lists_provinces_and_stations(self):
        hq, _ = self.signed_in(self.hq)
        tree = hq.get('/api/auth/console/org-tree/').json()
        provinces = {p['code']: [s['code'] for s in p['stations']] for p in tree['provinces']}
        self.assertEqual(provinces, {'PRV': ['STA'], 'PRB': ['STC']})

    def test_password_hash_is_never_returned(self):
        hq, _ = self.signed_in(self.hq)
        for url in ('/api/auth/console/users/', f'/api/auth/console/users/{self.clerk.pk}/'):
            body = hq.get(url).content.decode()
            self.clerk.refresh_from_db()
            self.assertNotIn(self.clerk.password.split('$')[-1], body)
            self.assertIn('pbkdf2_sha256', body)  # only the algorithm is shown

    def test_create_account(self):
        hq, _ = self.signed_in(self.hq)
        body = {'username': '2000001X', 'first_name': 'New', 'last_name': 'Officer', 'email': 'n@example.com',
                'role': role('HEALTH_OFFICER').pk, 'org_unit': self.sta.pk}
        r = hq.post('/api/auth/console/users/', body, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        _, login = self.login('2000001X', r.json()['temporary_password'])
        self.assertTrue(login.json()['must_change_password'])
        self.assertEqual(hq.post('/api/auth/console/users/', dict(body, username='bad'), format='json').status_code, 400)

    def test_station_admin_cannot_create_admins(self):
        c, _ = self.signed_in(self.stn_admin)
        body = {'username': '2000002Y', 'first_name': 'A', 'last_name': 'B',
                'role': role('STN_SYS_ADMIN').pk, 'org_unit': self.sta.pk}
        self.assertEqual(c.post('/api/auth/console/users/', body, format='json').status_code, 403)

    def test_storage_refresh_is_hq_only(self):
        hq, _ = self.signed_in(self.hq)
        self.assertEqual(hq.post('/api/auth/console/storage/').status_code, 200)
        stn, _ = self.signed_in(self.stn_admin)
        self.assertEqual(stn.post('/api/auth/console/storage/').status_code, 403)
        self.assertEqual(stn.get('/api/auth/console/storage/').status_code, 200)
