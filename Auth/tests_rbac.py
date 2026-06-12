from django.test import TestCase
from django.contrib.auth import get_user_model

from Auth.rbac import user_has_capability, ROLE_CAPABILITIES
from Auth.models import OrgUnit, Role, Department, UserAssignment


class RBACUtilsTest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='rbacuser', password='pw')

        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='PROV', name='Prov', code_short='PROV', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.stn = OrgUnit.objects.create(code='STN', name='Station', code_short='STN', unit_type='STATION', parent=self.prov)

        self.role_admin = Role.objects.create(code='ADMIN_OFFICER', name='Admin')
        self.role_reception = Role.objects.create(code='RECEPTION_OFFICER', name='Reception')
        self.dept = Department.objects.create(code='TEST', name='Test')

    def test_superuser_bypass(self):
        self.user.is_superuser = True
        self.user.save()
        assert user_has_capability(self.user, 'cases.delete', self.stn)

    def test_assignment_scope_inheritance(self):
        # Assign admin at provincial level -> should cover station
        UserAssignment.objects.create(user=self.user, role=self.role_admin, org_unit=self.prov, department=self.dept, is_primary=True, is_active=True)
        assert user_has_capability(self.user, 'cases.create', self.stn)
        # Reception role at station should not be able to delete (use separate user)
        User = get_user_model()
        ruser = User.objects.create_user(username='recv', password='pw')
        UserAssignment.objects.create(user=ruser, role=self.role_reception, org_unit=self.stn, department=self.dept, is_primary=True, is_active=True)
        assert not user_has_capability(ruser, 'cases.delete', self.stn)
