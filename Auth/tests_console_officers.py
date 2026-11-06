"""Console officers list and the two ways to create an account (existing HR officer, or new officer)."""
from django.contrib.auth import get_user_model

from Auth.models import AuditLog, Station, UserAssignment
from Auth.testing import role
from Auth.tests_console import NEW_OFFICER_HR, ConsoleBase
from HumanResources.models import Officer, OfficerStationHistory

User = get_user_model()
OFFICERS = '/api/auth/console/officers/'
USERS = '/api/auth/console/users/'


class ConsoleOfficerTests(ConsoleBase):
    def setUp(self):
        super().setUp()
        self.sta_legacy = Station.objects.create(code='STA', name='Station A', location='A')
        self.stc_legacy = Station.objects.create(code='STC', name='Station C', location='C')
        self.here = self.officer('6000001A', self.sta_legacy, '63-1000001 A 01')
        self.here_too = self.officer('6000002A', self.sta_legacy, '63-1000002 A 02')
        self.far = self.officer('6000003A', self.stc_legacy, '63-1000003 A 03')
        self.stn, _ = self.signed_in(self.stn_admin)
        self.reception = role('RECEPTION_OFFICER')

    def officer(self, sn, station, national_id, status='ACTIVE'):
        o = Officer.objects.create(service_number=sn, first_name='Tendai', surname=f'Moyo{sn[-2:]}',
                                   national_id=national_id, gender='Male', date_of_birth='1988-01-01',
                                   date_of_attestation='2010-01-01', current_status=status)
        OfficerStationHistory.objects.create(officer=o, station=station, date_posted='2015-01-01', posted_by='HQ')
        return o

    def numbers(self, client, **params):
        return {o['service_number'] for o in client.get(OFFICERS, params).json()['results']}

    # ---- listing ---------------------------------------------------------

    def test_station_admin_sees_own_station_officers_only(self):
        self.assertEqual(self.numbers(self.stn), {'6000001A', '6000002A'})
        hq, _ = self.signed_in(self.hq)
        self.assertTrue({'6000001A', '6000002A', '6000003A'} <= self.numbers(hq))

    def test_account_filter_and_link(self):
        self.stn.post(USERS, {'officer': '6000001A', 'role': self.reception.pk, 'org_unit': self.sta.pk},
                      format='json')
        self.assertEqual(self.numbers(self.stn, account='none'), {'6000002A'})
        self.assertEqual(self.numbers(self.stn, account='has'), {'6000001A'})
        row = next(o for o in self.stn.get(OFFICERS).json()['results'] if o['service_number'] == '6000001A')
        self.assertEqual(row['account']['username'], '6000001A')
        self.assertEqual(row['station'], 'Station A')

    def test_search(self):
        self.assertEqual(self.numbers(self.stn, q='6000002'), {'6000002A'})

    # ---- create from an existing officer -------------------------------

    def test_create_from_existing_officer_uses_hr_names(self):
        r = self.stn.post(USERS, {'officer': '6000001a', 'role': self.reception.pk, 'org_unit': self.sta.pk},
                          format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertFalse(r.json()['officer_registered'])
        user = User.objects.get(username='6000001A')
        self.assertEqual((user.first_name, user.last_name), ('Tendai', 'Moyo1A'))
        self.assertEqual(UserAssignment.objects.get(user=user).org_unit, self.sta)
        self.assertTrue(AuditLog.objects.filter(action='CREATE_ACCOUNT', object_id=str(user.pk),
                                                remarks__contains='existing HR officer').exists())

        again = self.stn.post(USERS, {'officer': '6000001A', 'role': self.reception.pk, 'org_unit': self.sta.pk},
                              format='json')
        self.assertEqual(again.status_code, 400)
        self.assertIn('already has an account', again.json()['officer'][0])

    def test_cannot_pick_officer_from_another_station(self):
        r = self.stn.post(USERS, {'officer': '6000003A', 'role': self.reception.pk, 'org_unit': self.sta.pk},
                          format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username='6000003A').exists())

    def test_cannot_pick_inactive_officer(self):
        self.officer('6000004A', self.sta_legacy, '63-1000004 A 04', status='SUSPENDED')
        r = self.stn.post(USERS, {'officer': '6000004A', 'role': self.reception.pk, 'org_unit': self.sta.pk},
                          format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('suspended', r.json()['officer'][0])

    # ---- create from scratch -------------------------------------------

    def new_officer(self, **overrides):
        body = {'username': '7000001A', 'first_name': 'Rudo', 'last_name': 'Chiweshe', 'other_names': 'Grace',
                'role': self.reception.pk, 'org_unit': self.sta.pk, **NEW_OFFICER_HR}
        body.update(overrides)
        return self.stn.post(USERS, body, format='json')

    def test_create_new_officer_registers_and_posts_them(self):
        r = self.new_officer()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.json()['officer_registered'])

        officer = Officer.objects.get(service_number='7000001A')
        self.assertEqual((officer.first_name, officer.other_names, officer.surname), ('Rudo', 'Grace', 'Chiweshe'))
        posting = OfficerStationHistory.objects.get(officer=officer)
        self.assertEqual((posting.station, posting.posting_org_unit, posting.date_transferred),
                         (self.sta_legacy, self.sta, None))
        # Now part of the station's officer list, with the account linked.
        row = next(o for o in self.stn.get(OFFICERS).json()['results'] if o['service_number'] == '7000001A')
        self.assertEqual(row['account']['username'], '7000001A')

    def test_new_officer_with_known_service_number_is_redirected_to_existing(self):
        r = self.new_officer(username='6000002A', national_id='63-9999999 A 99')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Existing officer', r.json()['username'][0])
        r = self.new_officer(username='6000003A', national_id='63-9999999 A 99')
        self.assertIn('another unit', r.json()['username'][0])

    def test_new_officer_validation_rolls_back(self):
        r = self.new_officer(national_id='not-an-id')
        self.assertEqual(r.status_code, 400)
        self.assertIn('national_id', r.json())
        r = self.new_officer(date_of_attestation='1980-01-01')  # before date of birth
        self.assertEqual(r.status_code, 400)
        self.assertIn('date_of_attestation', r.json())
        r = self.new_officer(national_id=self.here.national_id)  # national ID already used
        self.assertIn('national_id', r.json())
        self.assertFalse(Officer.objects.filter(service_number='7000001A').exists())
        self.assertFalse(User.objects.filter(username='7000001A').exists())

    def test_permission_checks_come_first(self):
        r = self.new_officer(org_unit=self.stc.pk)  # outside the station admin's area
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Officer.objects.filter(service_number='7000001A').exists())
