"""Creating provincial and station system admins from the console.

HQ creates provincial admins (at most two per province); a provincial admin
creates station admins (at most two per station) in their own province only.
The service number is the username.
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError

from Auth.models import AuditLog, UserAssignment, UserSecurity
from Auth.testing import assign, role
from Auth.tests_console import PW, ConsoleBase

User = get_user_model()
URL = '/api/auth/console/system-admins/'
NEW_PW = 'Zr8#pLm2!vKq9Tx'


def officers_url(unit):
    return f'/api/auth/console/units/{unit.pk}/officers/'


class SystemAdminTests(ConsoleBase):
    def setUp(self):
        super().setUp()
        self.prov_admin = self.make('1000005E', 'PROV_SYS_ADMIN', self.prv)

    def create(self, client, unit, service_number, password=NEW_PW, **extra):
        body = {'org_unit': unit.pk, 'service_number': service_number, 'password': password, **extra}
        return client.post(URL, body, format='json')

    # ---- HQ creates provincial admins ------------------------------------

    def test_hq_creates_provincial_admin_and_it_shows_in_province_table(self):
        hq, _ = self.signed_in(self.hq)
        r = self.create(hq, self.prb, '2000001a')  # lower case is accepted and upper-cased
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['username'], '2000001A')
        self.assertEqual((r.json()['used'], r.json()['limit']), (1, 2))

        user = User.objects.get(username='2000001A')
        a = UserAssignment.objects.get(user=user)
        self.assertEqual((a.role.code, a.org_unit, a.department.code, a.is_primary),
                         ('PROV_SYS_ADMIN', self.prb, 'IT', True))
        self.assertTrue(UserSecurity.objects.get(user=user).must_change_password)
        self.assertTrue(AuditLog.objects.filter(action='CREATE_SYSTEM_ADMIN', object_id=str(user.pk)).exists())

        table = hq.get(officers_url(self.prb)).json()
        self.assertEqual([o['username'] for o in table['officers']], ['2000001A'])
        self.assertTrue(table['officers'][0]['is_system_admin'])
        self.assertEqual(table['system_admins']['used'], 1)

        # Signs in with the password the admin set, and must change it.
        _, login = self.login('2000001A', NEW_PW)
        self.assertEqual(login.status_code, 200, login.content)
        self.assertTrue(login.json()['must_change_password'])

    def test_two_provincial_admins_per_province(self):
        hq, _ = self.signed_in(self.hq)
        self.assertEqual(self.create(hq, self.prb, '2000001A').status_code, 201)
        self.assertEqual(self.create(hq, self.prb, '2000002A').status_code, 201)
        r = self.create(hq, self.prb, '2000003A')
        self.assertEqual(r.status_code, 400)
        self.assertIn('limit is 2', r.json()['org_unit'][0])
        self.assertFalse(User.objects.filter(username='2000003A').exists())
        table = hq.get(officers_url(self.prb)).json()['system_admins']
        self.assertEqual((table['used'], table['can_create']), (2, False))
        # Province A has one already (setUp), so it still has a free slot.
        self.assertEqual(self.create(hq, self.prv, '2000004A').status_code, 201)
        self.assertEqual(self.create(hq, self.prv, '2000005A').status_code, 400)

    def test_disabled_admin_frees_a_slot_but_cannot_be_reenabled_over_the_limit(self):
        hq, _ = self.signed_in(self.hq)
        first = self.create(hq, self.prb, '2000001A').json()['id']
        self.create(hq, self.prb, '2000002A')
        r = hq.post(f'/api/auth/console/users/{first}/set-active/',
                    {'is_active': False, 'reason': 'Left the service'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.create(hq, self.prb, '2000003A').status_code, 201)
        r = hq.post(f'/api/auth/console/users/{first}/set-active/',
                    {'is_active': True, 'reason': 'Came back'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.get(pk=first).is_active)

    def test_limit_also_applies_to_role_assignments(self):
        hq, _ = self.signed_in(self.hq)
        self.create(hq, self.prv, '2000001A')  # Province A is now full (2)
        r = hq.post('/api/auth/user-assignments/', {
            'user': self.clerk.pk, 'role': role('PROV_SYS_ADMIN').pk, 'org_unit': self.prv.pk,
            'department': role('PROV_SYS_ADMIN').department_id, 'is_primary': False,
        }, format='json')
        self.assertEqual(r.status_code, 400, r.content)
        with self.assertRaises(DjangoValidationError):
            assign(self.far_clerk, role('PROV_SYS_ADMIN'), self.prv, primary=False)

    # ---- validation -------------------------------------------------------

    def test_service_number_is_the_username_and_must_be_valid(self):
        hq, _ = self.signed_in(self.hq)
        for bad in ('', '123456A', '12345678A', '1234567', 'ABCDEFGH', '1234567AB', 'admin'):
            r = self.create(hq, self.prb, bad)
            self.assertEqual(r.status_code, 400, bad)
            self.assertIn('service_number', r.json())
        r = self.create(hq, self.prb, self.clerk.username)  # already taken
        self.assertEqual(r.status_code, 400)
        self.assertIn('already exists', r.json()['service_number'][0])
        # A username field is ignored: the service number is always the username.
        r = self.create(hq, self.prb, '2000009Z', username='someone')
        self.assertEqual(r.json()['username'], '2000009Z')
        self.assertFalse(User.objects.filter(username='someone').exists())

    def test_weak_password_is_refused(self):
        hq, _ = self.signed_in(self.hq)
        r = self.create(hq, self.prb, '2000001A', password='123')
        self.assertEqual(r.status_code, 400)
        self.assertIn('password', r.json())
        self.assertFalse(User.objects.filter(username='2000001A').exists())

    def test_no_system_admin_at_national_hq(self):
        hq, _ = self.signed_in(self.hq)
        self.assertEqual(self.create(hq, self.nat, '2000001A').status_code, 400)

    # ---- provincial admins create station admins --------------------------

    def test_provincial_admin_creates_station_admins_in_own_province(self):
        c, _ = self.signed_in(self.prov_admin)
        r = self.create(c, self.sta, '3000001B')
        self.assertEqual(r.status_code, 201, r.content)
        a = UserAssignment.objects.get(user__username='3000001B')
        self.assertEqual((a.role.code, a.org_unit), ('STN_SYS_ADMIN', self.sta))
        names = [o['username'] for o in c.get(officers_url(self.sta)).json()['officers']]
        self.assertIn('3000001B', names)
        # Station A already had one station admin from setUp: 2 is the limit.
        r = self.create(c, self.sta, '3000002B')
        self.assertEqual(r.status_code, 400)
        self.assertIn('limit is 2', r.json()['org_unit'][0])

    def test_provincial_admin_is_limited_to_own_province(self):
        c, _ = self.signed_in(self.prov_admin)
        self.assertEqual(self.create(c, self.stc, '3000001B').status_code, 403)  # other province's station
        self.assertEqual(self.create(c, self.prb, '3000002B').status_code, 403)  # other province
        self.assertEqual(c.get(officers_url(self.stc)).status_code, 403)
        # Cannot create a peer at their own level.
        self.assertEqual(self.create(c, self.prv, '3000003B').status_code, 403)
        self.assertEqual(User.objects.filter(username__startswith='3000').count(), 0)

    def test_station_admins_and_officers_cannot_create_system_admins(self):
        for actor in (self.stn_admin, self.clerk):
            c, _ = self.signed_in(actor)
            self.assertIn(self.create(c, self.sta, '4000001C').status_code, (403,))
        self.assertFalse(User.objects.filter(username='4000001C').exists())

    def test_officer_table_lists_only_accounts_at_that_unit(self):
        hq, _ = self.signed_in(self.hq)
        prov = [o['username'] for o in hq.get(officers_url(self.prv)).json()['officers']]
        self.assertEqual(prov, [self.prov_admin.username])  # station staff are not in the province table
        stn = hq.get(officers_url(self.sta)).json()
        self.assertEqual([o['username'] for o in stn['officers']], [self.stn_admin.username, self.clerk.username])
        self.assertEqual(stn['system_admins']['role_code'], 'STN_SYS_ADMIN')

    def test_org_tree_reports_scope(self):
        hq, _ = self.signed_in(self.hq)
        self.assertEqual(hq.get('/api/auth/console/org-tree/').json()['scope'], 'NATIONAL')
        c, _ = self.signed_in(self.prov_admin)
        tree = c.get('/api/auth/console/org-tree/').json()
        self.assertEqual(tree['scope'], 'LIMITED')
        self.assertEqual([p['code'] for p in tree['provinces']], ['PRV'])
