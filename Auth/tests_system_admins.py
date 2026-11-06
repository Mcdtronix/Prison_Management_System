"""Creating provincial and station system admins from the console.

HQ creates provincial admins (at most two per province); a provincial admin
creates station admins (at most two per station) in their own province only.
The service number is the username.
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError

from Auth.models import AuditLog, OrgUnit, UserAssignment, UserSecurity
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


class StationConsoleScopeTests(ConsoleBase):
    """A station system admin uses the same console as HQ, but sees only their own station."""

    def setUp(self):
        super().setUp()
        self.prov_admin = self.make('1000005E', 'PROV_SYS_ADMIN', self.prv)
        self.sta_b = OrgUnit.objects.create(code='STB', name='Station B', code_short='STB', unit_type='STATION',
                                            parent=self.prv)
        self.sibling_clerk = self.make('1000006F', 'RECEPTION_OFFICER', self.sta_b)
        self.stn, _ = self.signed_in(self.stn_admin)

    def test_scope_level_for_each_admin_tier(self):
        for user, level, unit in ((self.hq, 'NATIONAL', 'NAT'), (self.prov_admin, 'PROVINCIAL', 'PRV'),
                                  (self.stn_admin, 'STATION', 'STA')):
            c, _ = self.signed_in(user)
            for url in ('overview', 'org-tree', 'storage'):
                body = c.get(f'/api/auth/console/{url}/').json()
                self.assertEqual(body['scope_level'], level, (user.username, url))
                self.assertEqual(body['scope_unit']['code'], unit, (user.username, url))

    def test_org_tree_holds_only_own_station(self):
        tree = self.stn.get('/api/auth/console/org-tree/').json()
        self.assertEqual(tree['provinces'], [])
        self.assertIsNone(tree['national'])
        self.assertEqual([s['code'] for s in tree['stations']], ['STA'])
        self.assertEqual(tree['scope_unit']['parent_name'], 'Province A')

    def test_overview_counts_only_own_station(self):
        counts = self.stn.get('/api/auth/console/overview/').json()['counts']
        self.assertEqual((counts['provinces'], counts['stations']), (0, 1))
        self.assertEqual(counts['users'], 2)  # the station admin and the clerk at Station A

    def test_users_list_and_details_stay_inside_the_station(self):
        names = {u['username'] for u in self.stn.get('/api/auth/console/users/').json()['results']}
        self.assertEqual(names, {self.stn_admin.username, self.clerk.username})
        for outsider in (self.sibling_clerk, self.far_clerk, self.prov_admin, self.hq):
            self.assertEqual(self.stn.get(f'/api/auth/console/users/{outsider.pk}/').status_code, 404)
        self.assertEqual(self.stn.get('/api/auth/console/users/', {'org_unit': self.sta_b.pk}).status_code, 403)

    def test_station_officers_table(self):
        body = self.stn.get(officers_url(self.sta)).json()
        self.assertEqual({o['username'] for o in body['officers']}, {self.stn_admin.username, self.clerk.username})
        slots = body['system_admins']
        self.assertEqual((slots['used'], slots['limit'], slots['allowed'], slots['can_create']), (1, 2, False, False))
        for other in (self.sta_b, self.prv, self.stc, self.nat):
            self.assertEqual(self.stn.get(officers_url(other)).status_code, 403, other.code)

    def test_provincial_admin_is_allowed_on_station_slots(self):
        c, _ = self.signed_in(self.prov_admin)
        slots = c.get(officers_url(self.sta)).json()['system_admins']
        self.assertEqual((slots['allowed'], slots['can_create']), (True, True))

    def test_activity_and_sign_ins_stay_inside_the_station(self):
        self.signed_in(self.sibling_clerk)
        self.signed_in(self.far_clerk)
        logins = {e['username'] for e in self.stn.get('/api/auth/console/logins/').json()['results']}
        self.assertNotIn(self.sibling_clerk.username, logins)
        self.assertNotIn(self.far_clerk.username, logins)
        online = {s['username'] for s in self.stn.get('/api/auth/console/online/').json()}
        self.assertFalse(online & {self.sibling_clerk.username, self.far_clerk.username})

    def test_storage_is_own_station_only_and_read_only(self):
        body = self.stn.get('/api/auth/console/storage/').json()
        self.assertEqual([u['id'] for u in body['units']], [self.sta.pk])
        self.assertIsNone(body['database_bytes'])
        self.assertEqual(self.stn.post('/api/auth/console/storage/').status_code, 403)

    def test_station_admin_creates_officers_at_own_station_only(self):
        body = {'username': '5000001A', 'first_name': 'New', 'last_name': 'Clerk',
                'role': role('RECEPTION_OFFICER').pk, 'org_unit': self.sta.pk}
        self.assertEqual(self.stn.post('/api/auth/console/users/', body, format='json').status_code, 201)
        r = self.stn.post('/api/auth/console/users/', dict(body, username='5000002A', org_unit=self.sta_b.pk),
                          format='json')
        self.assertEqual(r.status_code, 403)
        roles = {r['code'] for r in self.stn.get('/api/auth/console/grantable-roles/',
                                                 {'org_unit': self.sta.pk}).json()}
        self.assertNotIn('STN_SYS_ADMIN', roles)
        self.assertIn('RECEPTION_OFFICER', roles)
