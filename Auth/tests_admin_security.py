"""Regression tests for the Phase 0 admin security fixes.

Each test names the finding it covers (F1–F11 in docs/ADMIN_HIERARCHY_PLAN.md).
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from Auth.models import AuditLog, DataExposurePolicy, Department, OrgUnit, Role, UserAssignment
from Auth.rbac import user_has_capability
from HumanResources.models import Officer

User = get_user_model()
STRONG_PW = 'Kx9!vTq2#mLw7pZ'


def rows(resp):
    data = resp.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class AdminSecurityTestBase(TestCase):
    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='PRV', name='Province A', code_short='PRV', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.prov_b = OrgUnit.objects.create(code='PRB', name='Province B', code_short='PRB', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.stn = OrgUnit.objects.create(code='STA', name='Station A', code_short='STA', unit_type='STATION', parent=self.prov)
        self.stn2 = OrgUnit.objects.create(code='STB', name='Station B', code_short='STB', unit_type='STATION', parent=self.prov)
        self.stn_other = OrgUnit.objects.create(code='STC', name='Station C', code_short='STC', unit_type='STATION', parent=self.prov_b)

        self.r_super = Role.objects.create(code='SUPER_ADMIN', name='Super Admin')
        self.r_admin = Role.objects.create(code='ADMIN_OFFICER', name='Admin Officer')
        self.r_recep = Role.objects.create(code='RECEPTION_OFFICER', name='Reception Officer')
        self.dept = Department.objects.create(code='ADMIN', name='Administration')

        self.super_admin = self._user('super', self.r_super, self.nat)
        self.prov_admin = self._user('provadmin', self.r_admin, self.prov)
        self.stn_admin = self._user('stnadmin', self.r_admin, self.stn)
        self.clerk = self._user('clerk', self.r_recep, self.stn)
        self.newbie = User.objects.create_user(username='newbie', password=STRONG_PW)

    def _user(self, name, role, org):
        u = User.objects.create_user(username=name, password=STRONG_PW)
        UserAssignment.objects.create(user=u, role=role, org_unit=org, department=self.dept, is_primary=True)
        return u

    def client_for(self, user):
        # Real JWTs, so the org-context middleware runs as it does in production.
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(user).access_token}')
        return c

    def assign(self, actor, user, role, org):
        return self.client_for(actor).post('/api/auth/user-assignments/', {
            'user': user.pk, 'role': role.pk, 'org_unit': org.pk, 'department': self.dept.pk,
            'is_primary': False, 'is_active': True,
        }, format='json')


class RoleAssignmentTests(AdminSecurityTestBase):
    def test_f1_clerk_cannot_make_self_super_admin(self):
        resp = self.assign(self.clerk, self.clerk, self.r_super, self.nat)
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(user_has_capability(self.clerk, 'users.delete', self.stn_other))

    def test_f1_admin_cannot_change_own_assignments(self):
        self.assertEqual(self.assign(self.stn_admin, self.stn_admin, self.r_recep, self.stn).status_code, 403)

    def test_station_admin_cannot_create_peer_admin(self):
        self.assertEqual(self.assign(self.stn_admin, self.newbie, self.r_admin, self.stn).status_code, 403)

    def test_station_admin_can_grant_operational_role_at_own_station(self):
        self.assertEqual(self.assign(self.stn_admin, self.newbie, self.r_recep, self.stn).status_code, 201)

    def test_station_admin_cannot_grant_at_other_station(self):
        self.assertEqual(self.assign(self.stn_admin, self.newbie, self.r_recep, self.stn2).status_code, 403)

    def test_provincial_admin_can_create_station_admin_below(self):
        self.assertEqual(self.assign(self.prov_admin, self.newbie, self.r_admin, self.stn).status_code, 201)

    def test_provincial_admin_cannot_act_in_other_province(self):
        self.assertEqual(self.assign(self.prov_admin, self.newbie, self.r_recep, self.stn_other).status_code, 403)

    def test_nobody_but_super_admin_grants_super_admin(self):
        self.assertEqual(self.assign(self.prov_admin, self.newbie, self.r_super, self.stn).status_code, 403)
        self.assertEqual(self.assign(self.super_admin, self.newbie, self.r_super, self.nat).status_code, 201)

    def test_station_admin_cannot_edit_provincial_admin_assignment(self):
        ua = UserAssignment.objects.get(user=self.prov_admin)
        resp = self.client_for(self.stn_admin).patch(f'/api/auth/user-assignments/{ua.pk}/', {'is_active': False}, format='json')
        self.assertIn(resp.status_code, (403, 404))  # not even visible to them
        ua.refresh_from_db()
        self.assertTrue(ua.is_active)

    def test_station_admin_cannot_promote_clerk(self):
        ua = UserAssignment.objects.get(user=self.clerk)
        resp = self.client_for(self.stn_admin).patch(f'/api/auth/user-assignments/{ua.pk}/', {'role': self.r_admin.pk}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_assignment_list_is_scoped(self):
        names = {r['username'] for r in rows(self.client_for(self.stn_admin).get('/api/auth/user-assignments/'))}
        self.assertNotIn('provadmin', names)
        self.assertIn('clerk', names)
        names = {r['username'] for r in rows(self.client_for(self.clerk).get('/api/auth/user-assignments/'))}
        self.assertEqual(names, {'clerk'})


class RoleAndDepartmentTests(AdminSecurityTestBase):
    def test_f2_non_super_admin_cannot_change_roles_or_departments(self):
        for actor in (self.clerk, self.stn_admin, self.prov_admin):
            c = self.client_for(actor)
            self.assertEqual(c.post('/api/auth/roles/', {'code': 'EVIL', 'name': 'Evil'}, format='json').status_code, 403)
            self.assertEqual(c.delete(f'/api/auth/roles/{self.r_recep.pk}/').status_code, 403)
            self.assertEqual(c.post('/api/auth/departments/', {'code': 'EVIL', 'name': 'Evil'}, format='json').status_code, 403)
        self.assertTrue(Role.objects.filter(pk=self.r_recep.pk).exists())

    def test_everyone_can_read_roles(self):
        self.assertEqual(self.client_for(self.clerk).get('/api/auth/roles/').status_code, 200)

    def test_super_admin_can_create_role(self):
        resp = self.client_for(self.super_admin).post('/api/auth/roles/', {'code': 'NEW_ROLE', 'name': 'New'}, format='json')
        self.assertEqual(resp.status_code, 201)


class ExposurePolicyTests(AdminSecurityTestBase):
    def payload(self, **kw):
        data = {
            'code': 'POL-1', 'source_org_unit': self.stn.pk, 'target_org_unit': self.prov.pk,
            'module': 'RECEPTION', 'visibility_level': 'SUMMARY', 'status': 'DRAFT',
            'effective_from': timezone.now().isoformat(),
        }
        data.update(kw)
        return data

    def test_f3_clerk_cannot_create_policy(self):
        resp = self.client_for(self.clerk).post('/api/auth/data-exposure-policies/', self.payload(), format='json')
        self.assertEqual(resp.status_code, 403)

    def test_f3_policy_cannot_be_born_approved(self):
        resp = self.client_for(self.stn_admin).post('/api/auth/data-exposure-policies/', self.payload(status='APPROVED'), format='json')
        self.assertEqual(resp.status_code, 403)

    def test_f3_two_person_approval(self):
        resp = self.client_for(self.stn_admin).post('/api/auth/data-exposure-policies/', self.payload(), format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        pk = resp.json()['id']
        url = f'/api/auth/data-exposure-policies/{pk}/'
        self.assertEqual(self.client_for(self.stn_admin).patch(url, {'status': 'APPROVED'}, format='json').status_code, 403)
        resp = self.client_for(self.prov_admin).patch(url, {'status': 'APPROVED'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        policy = DataExposurePolicy.objects.get(pk=pk)
        self.assertEqual(policy.approved_by.user, self.prov_admin)
        self.assertEqual(policy.created_by.user, self.stn_admin)

    def test_policy_admin_cannot_forge_approver(self):
        resp = self.client_for(self.stn_admin).post('/api/auth/data-exposure-policies/',
                                                    self.payload(approved_by=self.super_admin.pk), format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(DataExposurePolicy.objects.get(pk=resp.json()['id']).approved_by)


class AdminWorkflowTests(AdminSecurityTestBase):
    def officer(self, sn='10000001'):
        return Officer.objects.create(
            service_number=sn, first_name='Test', surname='Officer', national_id=f'NI{sn}',
            gender='Male', date_of_birth=date(1990, 1, 1), date_of_attestation=date(2012, 1, 1),
            current_status='ACTIVE',
        )

    def test_f4_station_admin_cannot_create_super_admin(self):
        resp = self.client_for(self.prov_admin).post(f'/api/auth/admin-actions/{self.stn.pk}/create_admin/', {
            'officer': self.officer().pk, 'role': self.r_super.pk, 'password': STRONG_PW,
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_f11_admin_set_password_is_validated(self):
        resp = self.client_for(self.prov_admin).post(f'/api/auth/admin-actions/{self.stn.pk}/create_admin/', {
            'officer': self.officer().pk, 'role': self.r_admin.pk, 'password': '123',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('password', resp.json())

    def test_provincial_admin_creates_station_admin(self):
        resp = self.client_for(self.prov_admin).post(f'/api/auth/admin-actions/{self.stn.pk}/create_admin/', {
            'officer': self.officer().pk, 'role': self.r_admin.pk, 'password': STRONG_PW,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)

    def test_f5_station_requires_parent_in_scope(self):
        c = self.client_for(self.stn_admin)
        body = {'name': 'X', 'code': 'XX', 'code_short': 'XX'}
        self.assertEqual(c.post('/api/auth/admin-actions/station/', body, format='json').status_code, 400)
        self.assertEqual(c.post('/api/auth/admin-actions/station/', dict(body, parent=self.prov.pk), format='json').status_code, 403)
        c = self.client_for(self.prov_admin)
        self.assertEqual(c.post('/api/auth/admin-actions/station/', dict(body, parent=self.prov_b.pk), format='json').status_code, 403)
        self.assertEqual(c.post('/api/auth/admin-actions/station/', dict(body, parent=self.prov.pk), format='json').status_code, 201)

    def test_only_national_admins_create_provinces(self):
        body = {'name': 'New Prov', 'code': 'NPR', 'code_short': 'NPR'}
        self.assertEqual(self.client_for(self.stn_admin).post('/api/auth/admin-actions/phq/', body, format='json').status_code, 403)
        self.assertEqual(self.client_for(self.prov_admin).post('/api/auth/admin-actions/phq/', body, format='json').status_code, 403)
        resp = self.client_for(self.super_admin).post('/api/auth/admin-actions/phq/', body, format='json')
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(OrgUnit.objects.get(code='NPR').parent, self.nat)


class AuditLogScopeTests(AdminSecurityTestBase):
    def setUp(self):
        super().setUp()
        self.other_admin = self._user('otheradmin', self.r_admin, self.stn_other)
        for u in (self.super_admin, self.prov_admin, self.stn_admin, self.clerk, self.other_admin):
            AuditLog.objects.create(user=u, role='x', action=f'act-{u.username}', module='AUTH', ip_address='127.0.0.1')

    def actors(self, user):
        return {r['actor_username'] for r in rows(self.client_for(user).get('/api/auth/logs/'))}

    def test_f6_station_admin_sees_only_own_station(self):
        self.assertEqual(self.actors(self.stn_admin), {'stnadmin', 'clerk'})

    def test_provincial_admin_sees_its_stations(self):
        self.assertEqual(self.actors(self.prov_admin), {'provadmin', 'stnadmin', 'clerk'})

    def test_clerk_sees_only_own_logs(self):
        self.assertEqual(self.actors(self.clerk), {'clerk'})

    def test_super_admin_sees_all(self):
        self.assertLessEqual({'super', 'provadmin', 'stnadmin', 'clerk', 'otheradmin'}, self.actors(self.super_admin))


class TokenRevocationTests(AdminSecurityTestBase):
    def test_f10_logout_revokes_refresh_token(self):
        refresh = RefreshToken.for_user(self.clerk)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        self.assertEqual(c.post('/api/auth/logout/', {'refresh': str(refresh)}, format='json').status_code, 200)
        resp = APIClient().post('/api/auth/token/refresh/', {'refresh': str(refresh)}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_password_change_ends_existing_sessions(self):
        access = RefreshToken.for_user(self.clerk).access_token
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(c.get('/api/auth/me/').status_code, 200)
        self.clerk.set_password('An0ther!Strong#Pw')
        self.clerk.save()
        self.assertEqual(c.get('/api/auth/me/').status_code, 401)

    def test_disabled_user_is_rejected_immediately(self):
        access = RefreshToken.for_user(self.clerk).access_token
        self.clerk.is_active = False
        self.clerk.save()
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(c.get('/api/auth/me/').status_code, 401)


class CustomAdminRoleTests(AdminSecurityTestBase):
    """Admin roles created in the UI map onto the built-in tiers."""

    def test_hq_sys_admin_at_national_hq_is_super_admin(self):
        hq = self._user('hqsys', Role.objects.create(code='HQ_SYS_ADMIN', name='HQ Sys Admin'), self.nat)
        self.assertEqual(self.client_for(hq).post('/api/auth/roles/', {'code': 'R2', 'name': 'R2'}, format='json').status_code, 201)

    def test_super_admin_role_below_national_hq_is_not_global(self):
        rogue = self._user('rogue', self.r_super, self.stn)
        self.assertEqual(self.client_for(rogue).post('/api/auth/roles/', {'code': 'R3', 'name': 'R3'}, format='json').status_code, 403)
        self.assertEqual(self.assign(rogue, self.newbie, self.r_recep, self.stn_other).status_code, 403)

    def test_station_sys_admin_manages_own_station(self):
        sysadm = self._user('stnsys', Role.objects.create(code='SYS_ADMIN', name='Station Sys Admin'), self.stn2)
        self.assertEqual(self.assign(sysadm, self.newbie, self.r_recep, self.stn2).status_code, 201)
        self.assertEqual(self.assign(sysadm, self.newbie, self.r_recep, self.stn).status_code, 403)
