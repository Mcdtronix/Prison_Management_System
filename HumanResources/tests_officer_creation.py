"""Officers added in Officer Management appear in the station's list.

Bug (8 Nov 2026): an officer's station comes from their open posting. Creating
an officer recorded that posting only if the station also had a row in the
old auth_station table. Stations created in the console have none, so the
posting was skipped without any error, and the new officer appeared in no
station's "All Officers" list.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Auth.models import OrgUnit, Station, UserAssignment
from Auth.testing import department, role
from HumanResources.models import Officer, OfficerStationHistory

User = get_user_model()
URL = '/api/hr/officers/'


def new_officer(number):
    return {'service_number': number, 'first_name': 'New', 'surname': f'Officer{number[-2:]}',
            'national_id': f'63-{number}99', 'gender': 'Female', 'date_of_birth': '1992-04-01',
            'date_of_attestation': '2024-02-01', 'current_status': 'ACTIVE'}


class OfficerCreationTests(TestCase):
    def setUp(self):
        nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='MSE', name='Mashonaland East', code_short='MSE',
                                           unit_type='PROVINCIAL_HQ', parent=nat)
        # Created in the console: no row in the old auth_station table.
        self.marondera = OrgUnit.objects.create(code='MRD', name='Marondera Prison', code_short='MRD',
                                                unit_type='STATION', parent=self.prov)
        self.dept = department('ADMINISTRATION')
        self.admin = self.account('1500001A', self.marondera)

    def account(self, username, unit):
        user = User.objects.create_user(username=username, password='unused-test-pass')
        UserAssignment.objects.create(user=user, role=role('ADMIN_OFFICER'), org_unit=unit,
                                      department=self.dept, is_primary=True)
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    @staticmethod
    def numbers(response):
        data = response.json()
        rows = data['results'] if isinstance(data, dict) else data
        return {row['service_number'] for row in rows}

    def test_officer_added_at_a_console_station_appears_in_its_list(self):
        self.assertFalse(Station.objects.exists())
        client = self.client_for(self.admin)
        response = client.post(URL, new_officer('1500101A'), format='json')
        self.assertEqual(response.status_code, 201, response.content)

        posting = OfficerStationHistory.objects.get(officer_id='1500101A')
        self.assertEqual(posting.posting_org_unit, self.marondera)
        self.assertIsNone(posting.date_transferred)
        self.assertEqual(posting.station.code, 'MRD')  # old row created to match the unit
        self.assertIn('1500101A', self.numbers(client.get(URL)))

    def test_second_officer_reuses_the_same_station_row(self):
        client = self.client_for(self.admin)
        client.post(URL, new_officer('1500101A'), format='json')
        client.post(URL, new_officer('1500102A'), format='json')
        self.assertEqual(Station.objects.count(), 1)
        self.assertEqual(self.numbers(client.get(URL)), {'1500101A', '1500102A'})

    def test_existing_station_row_is_used(self):
        existing = Station.objects.create(code='MRD', name='Marondera Prison', location='Marondera')
        self.client_for(self.admin).post(URL, new_officer('1500101A'), format='json')
        self.assertEqual(OfficerStationHistory.objects.get(officer_id='1500101A').station, existing)
        self.assertEqual(Station.objects.count(), 1)

    def test_other_stations_still_cannot_see_the_officer(self):
        self.client_for(self.admin).post(URL, new_officer('1500101A'), format='json')
        other = OrgUnit.objects.create(code='MTK', name='Mutoko Prison', code_short='MTK',
                                       unit_type='STATION', parent=self.prov)
        self.assertNotIn('1500101A', self.numbers(self.client_for(self.account('1500002A', other)).get(URL)))

    # ---- repair_unposted_officers: officers saved by the old code with no posting

    def orphan(self, number, added_by):
        """An officer as the old code left it: saved, no posting, plus the audit entry of the request."""
        from Auth.models import AuditLog
        officer = Officer.objects.create(**{k: v for k, v in new_officer(number).items()})
        AuditLog.objects.create(user=added_by, role='ADMIN_OFFICER', action='CREATE_OFFICERS', module='API',
                                ip_address='127.0.0.1', request_method='POST', request_path='/api/hr/officers/',
                                remarks='status=201 org=MRD dept=ADMINISTRATION')
        return officer

    def repair(self, *args):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command('repair_unposted_officers', *args, stdout=out)
        return out.getvalue()

    def test_repair_shows_the_plan_and_changes_nothing_by_default(self):
        self.orphan('1500201A', self.admin)
        output = self.repair()
        self.assertIn('POST  1500201A', output)
        self.assertIn('-> ', output.replace('  ->  ', '-> '))
        self.assertIn('MRD (Marondera Prison)', output)
        self.assertFalse(OfficerStationHistory.objects.exists())

    def test_repair_apply_posts_them_where_they_were_added(self):
        self.orphan('1500201A', self.admin)
        self.orphan('1500202A', self.admin)
        client = self.client_for(self.admin)
        self.assertEqual(self.numbers(client.get(URL)), set())
        self.assertIn('Posted 2 officer(s)', self.repair('--apply'))
        self.assertEqual(self.numbers(client.get(URL)), {'1500201A', '1500202A'})
        self.assertIn('Nothing to do', self.repair())  # running again changes nothing

    def test_repair_skips_officers_added_by_someone_not_at_a_station(self):
        self.orphan('1500201A', self.account('1500004A', self.prov))
        output = self.repair('--apply')
        self.assertIn('SKIP  1500201A', output)
        self.assertFalse(OfficerStationHistory.objects.exists())

    def test_account_not_at_a_station_is_refused_and_nothing_is_saved(self):
        provincial = self.account('1500003A', self.prov)
        response = self.client_for(provincial).post(URL, new_officer('1500101A'), format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('not at a station', response.json()['detail'])
        self.assertFalse(Officer.objects.filter(service_number='1500101A').exists())
