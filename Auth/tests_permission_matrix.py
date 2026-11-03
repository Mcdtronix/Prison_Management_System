"""Phase 1: permission engine, grant matrix and the F7/F9 fixes."""
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from Auth.models import AuditLog, Department, OrgUnit, Role, RoleCapability, Station, UserAssignment, UserProfile
from Auth.permissions import IsHealthOfficer, IsStationDataOwner
from Auth.rbac import admin_scope, can, can_grant, can_manage_user, grantable_roles
from Auth.testing import department, role

User = get_user_model()
PW = 'Kx9!vTq2#mLw7pZ'


class MatrixBase(TestCase):
    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prv = OrgUnit.objects.create(code='PRV', name='Province A', code_short='PRV', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.prb = OrgUnit.objects.create(code='PRB', name='Province B', code_short='PRB', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.sta = OrgUnit.objects.create(code='STA', name='Station A', code_short='STA', unit_type='STATION', parent=self.prv)
        self.stb = OrgUnit.objects.create(code='STB', name='Station B', code_short='STB', unit_type='STATION', parent=self.prv)
        self.stc = OrgUnit.objects.create(code='STC', name='Station C', code_short='STC', unit_type='STATION', parent=self.prb)
        self.dept = department('ADMINISTRATION')

        self.r_nat = role('HQ_SYS_ADMIN')
        self.r_prov = role('PROV_SYS_ADMIN')
        self.r_stn = role('STN_SYS_ADMIN')
        self.r_rec = role('RECEPTION_OFFICER')
        self.r_health = role('HEALTH_OFFICER')
        self.r_ao = role('ADMIN_OFFICER')

        self.nat_admin = self.user('nat', self.r_nat, self.nat)
        self.prov_admin = self.user('prov', self.r_prov, self.prv)
        self.stn_admin = self.user('stn', self.r_stn, self.sta)
        self.clerk = self.user('clerk', self.r_rec, self.sta)

    def user(self, name, role_obj=None, org=None):
        u = User.objects.create_user(username=name, password=PW)
        if role_obj:
            UserAssignment.objects.create(user=u, role=role_obj, org_unit=org,
                                          department=role_obj.department or self.dept, is_primary=True)
        return u


class GrantMatrixTests(MatrixBase):
    """Plan §2.2: every actor tier against every role tier and target scope."""

    def test_matrix(self):
        A, D = 'allow', 'deny'
        n, p, s, c = self.nat_admin, self.prov_admin, self.stn_admin, self.clerk
        cases = [
            # actor, role,          org,      expected
            (n, self.r_nat,  self.nat, D),   # national -> national: break-glass only
            (n, self.r_prov, self.prv, A),
            (n, self.r_prov, self.prb, A),
            (n, self.r_stn,  self.stc, A),
            (n, self.r_rec,  self.stc, A),
            (p, self.r_prov, self.prv, D),   # own tier
            (p, self.r_prov, self.prb, D),
            (p, self.r_stn,  self.sta, A),   # station admin in own province
            (p, self.r_stn,  self.stc, D),   # other province
            (p, self.r_rec,  self.stb, A),
            (p, self.r_rec,  self.stc, D),
            (s, self.r_stn,  self.sta, D),   # own tier
            (s, self.r_rec,  self.sta, A),
            (s, self.r_rec,  self.stb, D),   # sibling station
            (s, self.r_rec,  self.prv, D),   # parent
            (c, self.r_rec,  self.sta, D),   # operational users grant nothing
            # assignable_at: admin roles only at their own level
            (n, self.r_stn,  self.prv, D),
            (n, self.r_prov, self.sta, D),
        ]
        for actor, role, org, expected in cases:
            with self.subTest(actor=actor.username, role=role.code, org=org.code):
                reason = can_grant(actor, role, org)
                self.assertEqual('allow' if reason is None else 'deny', expected, reason)

    def test_never_self(self):
        self.assertIsNotNone(can_grant(self.nat_admin, self.r_rec, self.sta, target_user=self.nat_admin))

    def test_grantable_roles_drive_dropdowns(self):
        codes = {r.code for r in grantable_roles(self.stn_admin, self.sta)}
        self.assertIn('RECEPTION_OFFICER', codes)
        self.assertNotIn('STN_SYS_ADMIN', codes)
        self.assertNotIn('HQ_SYS_ADMIN', codes)

    def test_api_enforces_matrix(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.prov_admin).access_token}')
        target = self.user('target')
        body = {'user': target.pk, 'department': self.r_stn.department_id, 'is_primary': True, 'is_active': True}
        self.assertEqual(c.post('/api/auth/user-assignments/', dict(body, role=self.r_prov.pk, org_unit=self.prv.pk), format='json').status_code, 403)
        self.assertEqual(c.post('/api/auth/user-assignments/', dict(body, role=self.r_stn.pk, org_unit=self.sta.pk), format='json').status_code, 201)


class ManageUserTests(MatrixBase):
    def test_cannot_manage_peer_or_higher(self):
        self.assertIsNotNone(can_manage_user(self.stn_admin, self.prov_admin))
        self.assertIsNotNone(can_manage_user(self.prov_admin, self.nat_admin))
        self.assertIsNotNone(can_manage_user(self.stn_admin, self.stn_admin))
        peer = self.user('peer', self.r_stn, self.sta)
        self.assertIsNotNone(can_manage_user(self.stn_admin, peer))

    def test_can_manage_users_below_in_scope(self):
        self.assertIsNone(can_manage_user(self.stn_admin, self.clerk))
        self.assertIsNone(can_manage_user(self.prov_admin, self.stn_admin))
        other = self.user('other', self.r_rec, self.stc)
        self.assertIsNotNone(can_manage_user(self.prov_admin, other))


class CapabilityTableTests(MatrixBase):
    def test_new_roles_get_default_capabilities(self):
        self.assertTrue(RoleCapability.objects.filter(role=self.r_health, capability='health.access').exists())

    def test_system_admins_have_no_operational_access(self):
        # Separation of duties (plan §2.4).
        for admin in (self.nat_admin, self.prov_admin, self.stn_admin):
            self.assertFalse(can(admin, 'health.access'))
            self.assertFalse(can(admin, 'reception.access'))
        ao = self.user('ao', self.r_ao, self.sta)
        self.assertTrue(can(ao, 'health.access'))      # Administration keeps operational access
        self.assertFalse(can(ao, 'users.manage'))      # but account management is IT's job

    def test_table_changes_take_effect(self):
        RoleCapability.objects.filter(role=self.r_rec, capability='reception.access').delete()
        self.assertFalse(can(self.clerk, 'reception.access'))
        RoleCapability.objects.create(role=self.r_rec, capability='reception.access')
        self.assertTrue(can(self.clerk, 'reception.access'))

    def test_scope_follows_hierarchy(self):
        self.assertIsNone(admin_scope(self.nat_admin, 'users.view'))
        self.assertEqual(admin_scope(self.prov_admin, 'users.view'), {self.prv.pk, self.sta.pk, self.stb.pk})
        self.assertEqual(admin_scope(self.stn_admin, 'users.view'), {self.sta.pk})
        self.assertEqual(admin_scope(self.clerk, 'users.view'), set())

    def test_disabled_custom_role_grants_nothing(self):
        custom = Role.objects.create(code='GATE_CLERK', name='Gate Clerk')
        RoleCapability.objects.create(role=custom, capability='reception.access')
        gate = self.user('gate', custom, self.sta)
        self.assertTrue(can(gate, 'reception.access'))
        custom.is_active = False
        custom.save()
        self.assertFalse(can(gate, 'reception.access'))

    def test_wildcard_below_national_hq_is_not_global(self):
        sup = role('SUPER_ADMIN')
        rogue = User.objects.create_user(username='rogue', password=PW)
        # Inserted directly: the API would refuse SUPER_ADMIN below National HQ.
        UserAssignment.objects.create(user=rogue, role=sup, org_unit=self.sta, department=self.dept, is_primary=True)
        self.assertFalse(can(rogue, 'roles.manage', strict=True))
        self.assertFalse(can(rogue, 'users.view', self.stc))

    def test_health_permission_class_uses_capabilities(self):
        req = RequestFactory().get('/')
        req.user = self.user('nurse', self.r_health, self.sta)
        self.assertTrue(IsHealthOfficer().has_permission(req, None))
        req.user = self.clerk
        self.assertFalse(IsHealthOfficer().has_permission(req, None))

    def test_legacy_profile_user_keeps_module_access(self):
        st = Station.objects.create(code='OLD', name='Old Station')
        u = self.user('legacy')
        UserProfile.objects.create(user=u, role=self.r_health, station=st)
        self.assertTrue(can(u, 'health.access'))
        self.assertFalse(can(u, 'health.access', self.sta))  # but never org-scoped power


class StationOwnerTests(MatrixBase):
    """F9: compare org units with org units, stations with stations."""

    class Obj:
        def __init__(self, owner=None, station_id=None):
            self.owner_org_unit = owner
            self.station_id = station_id

    def check(self, user, obj):
        req = RequestFactory().get('/')
        req.user = user
        return IsStationDataOwner().has_object_permission(req, None, obj)

    def test_owner_in_scope(self):
        self.assertTrue(self.check(self.clerk, self.Obj(owner=self.sta)))
        self.assertTrue(self.check(self.prov_admin, self.Obj(owner=self.stb)))

    def test_owner_out_of_scope(self):
        with self.assertRaises(PermissionDenied):
            self.check(self.clerk, self.Obj(owner=self.stb))

    def test_station_id_is_not_compared_with_org_unit_id(self):
        # Before F9 a legacy station id equal to the user's org unit id passed.
        st = Station.objects.create(code='X', name='X')
        with self.assertRaises(PermissionDenied):
            self.check(self.clerk, self.Obj(station_id=st.pk))


class AuditCoverageTests(MatrixBase):
    """F7: users with only a new-style assignment are audited."""

    def test_assignment_only_admin_is_logged(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.stn_admin).access_token}')
        before = AuditLog.objects.filter(user=self.stn_admin, module='API').count()
        c.post('/api/auth/user-assignments/', {}, format='json')
        log = AuditLog.objects.filter(user=self.stn_admin, module='API').order_by('-id').first()
        self.assertEqual(AuditLog.objects.filter(user=self.stn_admin, module='API').count(), before + 1)
        self.assertEqual(log.role, 'STN_SYS_ADMIN')
        self.assertIn('org=STA', log.remarks)


class BuiltinStructureTests(MatrixBase):
    """Built-in roles and departments are fixed; custom ones can be added."""

    def hq(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.nat_admin).access_token}')
        return c

    def test_builtin_set_exists(self):
        self.assertEqual(
            set(Department.objects.filter(is_system=True).values_list('code', flat=True)),
            {'IT', 'ADMINISTRATION', 'RECEPTION', 'HEALTH', 'STORES', 'SECURITY', 'REHABILITATION', 'FARMS'})
        roles = set(Role.objects.filter(is_system=True).values_list('code', flat=True))
        for code in ('HQ_SYS_ADMIN', 'PROV_SYS_ADMIN', 'STN_SYS_ADMIN', 'ADMIN_OFFICER', 'RECEPTION_OFFICER',
                     'HEALTH_OFFICER', 'STORES_OFFICER', 'FARMS_OFFICER', 'SECURITY_OFFICER'):
            self.assertIn(code, roles)

    def test_all_system_admins_are_in_it(self):
        for code in ('HQ_SYS_ADMIN', 'PROV_SYS_ADMIN', 'STN_SYS_ADMIN'):
            self.assertEqual(Role.objects.get(code=code).department.code, 'IT')

    def test_builtin_role_cannot_be_deleted_renamed_or_disabled(self):
        r = self.r_rec
        c = self.hq()
        self.assertEqual(c.delete(f'/api/auth/roles/{r.pk}/').status_code, 400)
        self.assertEqual(c.patch(f'/api/auth/roles/{r.pk}/', {'code': 'X'}, format='json').status_code, 400)
        self.assertEqual(c.patch(f'/api/auth/roles/{r.pk}/', {'is_active': False}, format='json').status_code, 400)
        self.assertEqual(c.patch(f'/api/auth/roles/{r.pk}/', {'name': 'Reception Clerk'}, format='json').status_code, 200)

    def test_builtin_department_cannot_be_deleted(self):
        it = Department.objects.get(code='IT')
        self.assertEqual(self.hq().delete(f'/api/auth/departments/{it.pk}/').status_code, 400)

    def test_custom_department_and_role(self):
        c = self.hq()
        resp = c.post('/api/auth/departments/', {'code': 'WORKSHOPS', 'name': 'Workshops'}, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        dept_id = resp.json()['id']
        resp = c.post('/api/auth/roles/', {'code': 'WORKSHOP_OFFICER', 'name': 'Workshop Officer',
                                          'department': dept_id}, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertFalse(resp.json()['is_system'])
        self.assertEqual(c.delete(f"/api/auth/roles/{resp.json()['id']}/").status_code, 204)
        self.assertEqual(c.delete(f'/api/auth/departments/{dept_id}/').status_code, 204)

    def test_department_in_use_cannot_be_deleted(self):
        dept = department('WORKSHOPS', 'Workshops')
        r = Role.objects.create(code='WORKSHOP_OFFICER', name='Workshop Officer', department=dept)
        self.user('fitter', r, self.sta)
        self.assertEqual(self.hq().delete(f'/api/auth/departments/{dept.pk}/').status_code, 400)

    def test_role_must_be_assigned_in_its_department(self):
        target = self.user('target')
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.stn_admin).access_token}')
        wrong = Department.objects.get(code='HEALTH')
        resp = c.post('/api/auth/user-assignments/', {'user': target.pk, 'role': self.r_rec.pk, 'org_unit': self.sta.pk,
                                                      'department': wrong.pk, 'is_primary': True}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('department', resp.json())


class ZimbabweStructureTests(TestCase):
    def test_provinces_and_stations(self):
        from django.core.management import call_command
        from io import StringIO
        nhq = OrgUnit.objects.create(code='NAT_HQ', name='National HQ', code_short='HQ', unit_type='NATIONAL_HQ')
        Station.objects.create(code='St Thomas Prison', name='Marondera Prison')
        call_command('setup_zimbabwe_structure', apply=True, stdout=StringIO())
        call_command('setup_zimbabwe_structure', apply=True, stdout=StringIO())  # idempotent
        self.assertEqual(OrgUnit.objects.filter(unit_type='PROVINCIAL_HQ', parent=nhq).count(), 10)
        for station, province in [('Chikurubi Maximum Prison', 'HRE'), ('Harare Central Prison', 'HRE'),
                                  ('Harare Remand Prison', 'HRE'), ('Chivhu Prison', 'MASH_EAST'),
                                  ('Ridigita Prison', 'MASH_EAST'), ('Marondera Prison', 'MASH_EAST')]:
            self.assertEqual(OrgUnit.objects.get(name=station, unit_type='STATION').parent.code, province)

    def test_empty_database_gets_national_hq(self):
        from django.core.management import call_command
        from io import StringIO
        from Auth.models import SystemConfig
        call_command('setup_zimbabwe_structure', stdout=StringIO())  # dry run writes nothing
        self.assertFalse(OrgUnit.objects.exists())
        call_command('setup_zimbabwe_structure', apply=True, stdout=StringIO())
        nhq = OrgUnit.objects.get(unit_type='NATIONAL_HQ')
        self.assertEqual(OrgUnit.objects.filter(unit_type='PROVINCIAL_HQ', parent=nhq).count(), 10)
        self.assertEqual(OrgUnit.objects.filter(unit_type='STATION').count(), 6)
        self.assertEqual(SystemConfig.objects.get().national_hq, nhq)

    def test_hq_admin_option(self):
        from django.core.management import call_command
        from io import StringIO
        boss = User.objects.create_superuser('BOSS1', 'b@example.com', PW)
        call_command('setup_zimbabwe_structure', apply=True, hq_admin='BOSS1', stdout=StringIO())
        call_command('setup_zimbabwe_structure', apply=True, hq_admin='BOSS1', stdout=StringIO())
        a = UserAssignment.objects.get(user=boss)
        self.assertEqual((a.role.code, a.department.code, a.org_unit.unit_type, a.is_primary),
                         ('HQ_SYS_ADMIN', 'IT', 'NATIONAL_HQ', True))
