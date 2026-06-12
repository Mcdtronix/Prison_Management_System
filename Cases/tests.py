from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import CaseFile
from Auth.models import OrgUnit, Role, UserAssignment, Department


class CasesSmokeTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        User = get_user_model()
        self.user = User.objects.create_user(username='caseuser', password='pass')
        # create org unit hierarchy: National -> Provincial -> Station (OrgUnit model enforces parents)
        nat = OrgUnit.objects.create(code='NAT_TEST', name='National Test HQ', code_short='NAT', unit_type='NATIONAL_HQ')
        prov = OrgUnit.objects.create(code='PROV_TEST', name='Provincial Test HQ', code_short='PROV', unit_type='PROVINCIAL_HQ', parent=nat)
        # create station with required code_short and parent
        self.org = OrgUnit.objects.create(code='TEST_STN', name='Test Station', code_short='STN', unit_type='STATION', parent=prov)
        role = Role.objects.create(code='ADMIN_OFFICER', name='Admin Officer')
        dept = Department.objects.create(code='TEST_DEPT', name='Test Department')
        UserAssignment.objects.create(user=self.user, role=role, org_unit=self.org, department=dept, is_primary=True, is_active=True)

    def test_casefile_model_create(self):
        cf = CaseFile.objects.create(reference='CF-ORM', title='ORM Case', owner_org_unit=self.org, created_by=self.user)
        self.assertEqual(CaseFile.objects.count(), 1)
