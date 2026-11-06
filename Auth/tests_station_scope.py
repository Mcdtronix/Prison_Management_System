"""Officer and account lists show only the requester's station (Auth/scoping.py)."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Auth.models import OrgUnit, Station, UserAssignment, UserProfile
from Auth.testing import department, role
from HumanResources.models import Officer, OfficerStationHistory

User = get_user_model()

OFFICERS_URL = '/api/hr/officers/'
ACCOUNTS_URL = '/api/auth/users/'


class StationScopeTests(TestCase):
    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='MSV', name='Masvingo Province', code_short='MSV',
                                           unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.chivhu = OrgUnit.objects.create(code='CHV', name='Chivhu Prison', code_short='CHV',
                                             unit_type='STATION', parent=self.prov)
        self.harare = OrgUnit.objects.create(code='HRE', name='Harare Prison', code_short='HRE',
                                             unit_type='STATION', parent=self.prov)
        # Legacy station rows, matched to the org units by code.
        self.chivhu_legacy = Station.objects.create(code='CHV', name='Chivhu Prison', location='Chivhu')
        self.harare_legacy = Station.objects.create(code='HRE', name='Harare Prison', location='Harare')
        unmapped = Station.objects.create(code='OLD', name='Old Record', location='-')

        self.dept = department('ADMINISTRATION')
        self.r_ao = role('ADMIN_OFFICER')
        self.r_rec = role('RECEPTION_OFFICER')
        self.r_prov = role('PROV_SYS_ADMIN')

        self.chivhu_ao = self.account('1000001A', self.r_ao, self.chivhu)
        self.prov_admin = self.account('1000002A', self.r_prov, self.prov)

        # HR records
        self.posted_chivhu = self.officer('2000001A', posting=(self.chivhu_legacy, None))
        self.posted_by_unit = self.officer('2000002A', posting=(unmapped, self.chivhu))
        self.posted_harare = self.officer('2000003A', posting=(self.harare_legacy, None))
        self.transferred_out = self.officer('2000004A', posting=(self.harare_legacy, None))
        OfficerStationHistory.objects.create(officer=self.transferred_out, station=self.chivhu_legacy,
                                             date_posted='2016-01-01', date_transferred='2019-12-31',
                                             posted_by='HQ')
        # Created by the provincial admin from the console: an account at
        # Chivhu but no posting row.
        self.console_officer = self.officer('2000005A')
        self.account('2000005A', self.r_rec, self.chivhu)

        # Accounts elsewhere
        self.account('3000001A', self.r_rec, self.harare)
        legacy = User.objects.create_user(username='3000002A', password='x')
        UserProfile.objects.create(user=legacy, role=self.r_rec, station=self.chivhu_legacy, is_active=True)
        legacy_far = User.objects.create_user(username='3000003A', password='x')
        UserProfile.objects.create(user=legacy_far, role=self.r_rec, station=self.harare_legacy, is_active=True)

    # ---- helpers

    def account(self, username, role_obj, unit):
        user = User.objects.create_user(username=username, password='x')
        UserAssignment.objects.create(user=user, role=role_obj, org_unit=unit,
                                      department=role_obj.department or self.dept, is_primary=True)
        return user

    def officer(self, service_number, posting=None):
        officer = Officer.objects.create(
            service_number=service_number, first_name='First', surname=service_number,
            national_id=f'NI-{service_number}', gender='Male', date_of_birth='1990-01-01',
            date_of_attestation='2015-01-01', current_status='ACTIVE',
        )
        if posting:
            station, unit = posting
            OfficerStationHistory.objects.create(officer=officer, station=station, posting_org_unit=unit,
                                                 date_posted='2020-01-01', posted_by='HQ')
        return officer

    def get(self, user, url):
        client = APIClient()
        client.force_authenticate(user)
        response = client.get(url)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def officer_numbers(self, user):
        data = self.get(user, OFFICERS_URL)
        rows = data['results'] if isinstance(data, dict) else data
        return {r['service_number'] for r in rows}

    def account_names(self, user):
        return {r['username'] for r in self.get(user, ACCOUNTS_URL)}

    # ---- officers

    def test_station_admin_sees_only_officers_posted_there(self):
        self.assertEqual(self.officer_numbers(self.chivhu_ao), {'2000001A', '2000002A', '2000005A'})

    def test_officer_with_console_account_counts_without_posting(self):
        self.assertIn('2000005A', self.officer_numbers(self.chivhu_ao))

    def test_transferred_officer_leaves_old_station(self):
        self.assertNotIn('2000004A', self.officer_numbers(self.chivhu_ao))

    def test_officer_elsewhere_cannot_be_opened_by_url(self):
        client = APIClient()
        client.force_authenticate(self.chivhu_ao)
        self.assertEqual(client.get(f'{OFFICERS_URL}{self.posted_harare.pk}/').status_code, 404)
        self.assertEqual(client.get(f'{OFFICERS_URL}{self.posted_chivhu.pk}/').status_code, 200)

    def test_provincial_admin_sees_every_station_in_province(self):
        self.assertEqual(self.officer_numbers(self.prov_admin),
                         {'2000001A', '2000002A', '2000003A', '2000004A', '2000005A'})

    # ---- accounts

    def test_station_admin_sees_only_accounts_there(self):
        self.assertEqual(self.account_names(self.chivhu_ao), {'1000001A', '2000005A', '3000002A'})

    def test_console_account_row_has_no_profile_id(self):
        row = next(r for r in self.get(self.chivhu_ao, ACCOUNTS_URL) if r['username'] == '2000005A')
        self.assertIsNone(row['id'])
        self.assertEqual(row['station_code'], 'CHV')
        self.assertEqual(row['role_code'], 'RECEPTION_OFFICER')
        self.assertEqual(row['officer_service_number'], '2000005A')

    def test_unassigned_user_sees_nobody(self):
        stranger = User.objects.create_user(username='stranger', password='x')
        self.assertEqual(self.officer_numbers(stranger), set())
