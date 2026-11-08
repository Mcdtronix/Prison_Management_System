"""Station isolation: officers see and change only records held where they work.

Security audit 2026-11-08, finding C2. Before the fix, an account with no role
and no station could list every offence, next of kin, court session and
upcoming discharge in the country, and change most of them. These tests pin
the fix: two stations (Chivhu, Harare) in one province, and accounts that
must not see across the line.
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from Auth.models import OrgUnit, Station, UserAssignment, UserProfile
from Auth.testing import department, role
from HumanResources.models import Officer, OfficerRankHistory, OfficerStationHistory, Rank
from Reception.models import (
    Convicted, CourtSession, Inmate, InmateAuditTrail, InmateStationHistory, NextOfKin, Offence,
    ReleaseHistory, ReleaseWorkflow,
)

User = get_user_model()
REMANDED = date(2026, 11, 2)


class StationIsolationBase(TestCase):
    def setUp(self):
        nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='MSV', name='Masvingo', code_short='MSV',
                                           unit_type='PROVINCIAL_HQ', parent=nat)
        self.chivhu = OrgUnit.objects.create(code='CHV', name='Chivhu Prison', code_short='CHV',
                                             unit_type='STATION', parent=self.prov)
        self.harare = OrgUnit.objects.create(code='HRE', name='Harare Prison', code_short='HRE',
                                             unit_type='STATION', parent=self.prov)
        self.chivhu_legacy = Station.objects.create(code='CHV', name='Chivhu Prison', location='Chivhu')
        self.harare_legacy = Station.objects.create(code='HRE', name='Harare Prison', location='Harare')
        self.dept = department('ADMINISTRATION')

        self.reception = self.account('1200001A', 'RECEPTION_OFFICER', self.chivhu)
        self.admin = self.account('1200002A', 'ADMIN_OFFICER', self.chivhu)
        self.farms = self.account('1200003A', 'FARMS_OFFICER', self.chivhu)
        self.provincial = self.account('1200004A', 'ADMIN_OFFICER', self.prov)
        self.nobody = User.objects.create_user(username='1200005A', password='unused-test-pass')

        self.mine = self.inmate('0001/26', self.chivhu)
        self.theirs = self.inmate('0002/26', self.harare)
        self.my_offence = self.offence(self.mine)
        self.their_offence = self.offence(self.theirs)

    # ---- helpers

    def account(self, username, role_code, unit):
        user = User.objects.create_user(username=username, password='unused-test-pass')
        role_obj = role(role_code)
        UserAssignment.objects.create(user=user, role=role_obj, org_unit=unit,
                                      department=role_obj.department or self.dept, is_primary=True)
        return user

    def inmate(self, number, unit):
        inmate = Inmate.objects.create(
            prison_number=number, first_name='Test', surname=number.replace('/', ''), gender='Male',
            date_of_birth=date(1990, 1, 1), nationality='Zimbabwean', admission_date=REMANDED,
            owner_org_unit=unit,
        )
        NextOfKin.objects.create(inmate=inmate, full_name=f'Kin of {number}', relationship='Brother',
                                 address='1 Main Rd', contact='0770000000')
        InmateAuditTrail.objects.create(inmate=inmate, action='Admitted', performed_by='test')
        return inmate

    def offence(self, inmate):
        offence = Offence.objects.create(
            inmate=inmate, offence_description='Theft', court='Magistrates', Offence_status='UNCONVICTED',
            date_charged=REMANDED,
        )
        CourtSession.objects.create(offence=offence, session_date=REMANDED + timedelta(days=30),
                                    outcome='SCHEDULED', next_court_date=REMANDED + timedelta(days=30))
        return offence

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    @staticmethod
    def rows(response):
        data = response.json()
        return data['results'] if isinstance(data, dict) and 'results' in data else data


class ReceptionRecordListsTests(StationIsolationBase):
    # endpoint -> how a row names its inmate
    LISTS = {
        '/api/reception/offences/': lambda row: row['inmate'],
        '/api/reception/next-of-kin/': lambda row: Inmate.objects.get(
            prison_number=row['full_name'].removeprefix('Kin of ')).id,
        '/api/reception/court-sessions/': lambda row: Offence.objects.get(pk=row['offence']).inmate_id,
        '/api/reception/audit-trail/': lambda row: row['inmate'],
        '/api/reception/inmates/': lambda row: row['id'],
    }

    def test_station_officer_sees_only_own_station(self):
        client = self.client_for(self.reception)
        for url, inmate_of in self.LISTS.items():
            with self.subTest(url=url):
                response = client.get(url)
                self.assertEqual(response.status_code, 200, response.content)
                inmates = {inmate_of(row) for row in self.rows(response)}
                self.assertEqual(inmates, {self.mine.id})

    def test_provincial_officer_sees_every_station_below(self):
        response = self.client_for(self.provincial).get('/api/reception/offences/')
        self.assertEqual({row['inmate'] for row in self.rows(response)}, {self.mine.id, self.theirs.id})

    def test_account_without_role_is_refused(self):
        client = self.client_for(self.nobody)
        for url in list(self.LISTS) + ['/api/reception/convicted/', '/api/reception/restitution/',
                                       '/api/reception/court-sessions/upcoming/',
                                       '/api/reception/discharges/upcoming/', '/api/reception/inmate-list/',
                                       '/api/reception/analytics/']:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 403)

    def test_other_departments_are_refused(self):
        self.assertEqual(self.client_for(self.farms).get('/api/reception/offences/').status_code, 403)

    def test_record_at_another_station_cannot_be_opened(self):
        client = self.client_for(self.reception)
        self.assertEqual(client.get(f'/api/reception/offences/{self.their_offence.id}/').status_code, 404)
        kin = NextOfKin.objects.get(inmate=self.theirs)
        self.assertEqual(client.get(f'/api/reception/next-of-kin/{kin.id}/').status_code, 404)
        self.assertEqual(client.delete(f'/api/reception/next-of-kin/{kin.id}/').status_code, 404)
        self.assertTrue(NextOfKin.objects.filter(pk=kin.pk).exists())

    def test_upcoming_court_sessions_are_scoped(self):
        rows = self.client_for(self.reception).get('/api/reception/court-sessions/upcoming/').json()
        self.assertEqual({row['id'] for row in rows},
                         set(CourtSession.objects.filter(offence=self.my_offence).values_list('id', flat=True)))

    def test_upcoming_discharges_are_scoped(self):
        edr = timezone.localdate() + timedelta(days=20)
        for inmate in (self.mine, self.theirs):
            ReleaseHistory.objects.update_or_create(
                inmate=inmate,
                defaults=dict(total_effective_sentence=12, earliest_date_of_release=edr, active_edr=edr))
        response = self.client_for(self.reception).get('/api/reception/discharges/upcoming/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn(self.theirs.prison_number, response.content.decode())

    def test_legacy_profile_account_sees_its_station(self):
        legacy = User.objects.create_user(username='1200006A', password='unused-test-pass')
        UserProfile.objects.create(user=legacy, role=role('RECEPTION_OFFICER'), station=self.chivhu_legacy,
                                   is_active=True)
        response = self.client_for(legacy).get('/api/reception/offences/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual({row['inmate'] for row in self.rows(response)}, {self.mine.id})

    def test_unowned_legacy_inmate_follows_station_history(self):
        old = self.inmate('0003/26', None)
        InmateStationHistory.objects.create(inmate=old, station=self.harare_legacy, date_admitted=REMANDED,
                                            reason='Admission')
        self.offence(old)
        response = self.client_for(self.reception).get('/api/reception/offences/')
        self.assertNotIn(old.id, {row['inmate'] for row in self.rows(response)})


class ReceptionRecordWritesTests(StationIsolationBase):
    def new_offence(self, inmate):
        return {'inmate': inmate.id, 'offence_description': 'Planted', 'court': 'Magistrates',
                'Offence_status': 'UNCONVICTED', 'date_charged': '2026-11-03'}

    def test_cannot_attach_record_to_another_stations_inmate(self):
        response = self.client_for(self.reception).post(
            '/api/reception/offences/', self.new_offence(self.theirs), format='json')
        self.assertEqual(response.status_code, 403, response.content)
        self.assertFalse(Offence.objects.filter(offence_description='Planted').exists())

    def test_can_attach_record_to_own_inmate(self):
        response = self.client_for(self.reception).post(
            '/api/reception/offences/', self.new_offence(self.mine), format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_cannot_move_record_to_another_stations_inmate(self):
        response = self.client_for(self.reception).patch(
            f'/api/reception/offences/{self.my_offence.id}/', {'inmate': self.theirs.id}, format='json')
        self.assertEqual(response.status_code, 403, response.content)
        self.my_offence.refresh_from_db()
        self.assertEqual(self.my_offence.inmate_id, self.mine.id)

    def test_health_officer_reads_but_cannot_change(self):
        health = self.account('1200007A', 'HEALTH_OFFICER', self.chivhu)
        client = self.client_for(health)
        self.assertEqual(client.get('/api/reception/offences/').status_code, 200)
        self.assertEqual(client.patch(f'/api/reception/offences/{self.my_offence.id}/', {'court': 'x'},
                                      format='json').status_code, 403)

    def test_audit_trail_is_read_only(self):
        entry = InmateAuditTrail.objects.filter(inmate=self.mine).first()
        client = self.client_for(self.admin)
        self.assertEqual(client.delete(f'/api/reception/audit-trail/{entry.id}/').status_code, 405)
        self.assertEqual(client.post('/api/reception/audit-trail/', {'inmate': self.mine.id, 'action': 'x'},
                                     format='json').status_code, 405)
        self.assertTrue(InmateAuditTrail.objects.filter(pk=entry.pk).exists())

    def test_cannot_schedule_court_for_another_station(self):
        response = self.client_for(self.reception).post('/api/reception/court-sessions/schedule/', {
            'offence_id': self.their_offence.id, 'next_court_date': '2026-12-20',
            'warrant_document': SimpleUploadedFile('warrant.pdf', b'%PDF-1.4 test', 'application/pdf'),
        })
        self.assertEqual(response.status_code, 404, response.content)

    def test_cannot_register_offences_for_another_station(self):
        response = self.client_for(self.reception).post('/api/reception/register-offences/', {
            'inmate_id': self.theirs.id,
            'offences': [{'offence': 'Theft', 'convictionStatus': 'unconvicted', 'court': 'Magistrates',
                          'nextCourtDate': '2026-12-20'}],
        }, format='json')
        self.assertEqual(response.status_code, 403, response.content)

    def test_cannot_approve_another_stations_discharge(self):
        workflow = ReleaseWorkflow.objects.create(inmate=self.theirs, reception_reason='Sentence expired')
        response = self.client_for(self.admin).post(
            f'/api/reception/discharge_approvals/{workflow.id}/approve/', {'remarks': 'x'}, format='json')
        self.assertEqual(response.status_code, 404, response.content)
        self.theirs.refresh_from_db()
        self.assertNotEqual(self.theirs.current_status, 'DISCHARGED')
        pending = self.client_for(self.admin).get('/api/reception/discharge_approvals/pending/').json()
        self.assertEqual(pending, [])

    def test_cannot_propose_discharge_at_another_station(self):
        response = self.client_for(self.reception).post('/api/reception/discharges/propose/', {
            'inmate_id': self.theirs.id, 'reception_reason': 'Sentence expired',
        })
        self.assertIn(response.status_code, (400, 404), response.content)
        self.assertFalse(ReleaseWorkflow.objects.filter(inmate=self.theirs).exists())


class OfficerRecordTests(StationIsolationBase):
    def setUp(self):
        super().setUp()
        self.rank = Rank.objects.create(name='Officer', rank_level=1)
        self.my_officer = self.officer('2200001A', self.chivhu_legacy)
        self.their_officer = self.officer('2200002A', self.harare_legacy)
        self.change_type = OfficerRankHistory._meta.get_field('change_type').choices[0][0]
        for officer in (self.my_officer, self.their_officer):
            OfficerRankHistory.objects.create(officer=officer, rank=self.rank, effective_date='2020-01-01',
                                              change_type=self.change_type, authority='HQ')

    def officer(self, number, station):
        officer = Officer.objects.create(
            service_number=number, first_name='First', surname=number, national_id=f'NI-{number}',
            gender='Male', date_of_birth='1990-01-01', date_of_attestation='2015-01-01', current_status='ACTIVE',
        )
        OfficerStationHistory.objects.create(officer=officer, station=station, date_posted='2020-01-01',
                                             posted_by='HQ')
        return officer

    def test_admin_officer_sees_only_own_station_officers_records(self):
        response = self.client_for(self.admin).get('/api/hr/rank-history/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual({row['officer'] for row in self.rows(response)}, {self.my_officer.pk})

    def test_admin_officer_can_add_record_for_own_officer(self):
        response = self.client_for(self.admin).post('/api/hr/rank-history/', {
            'officer': self.my_officer.pk, 'rank': self.rank.id, 'effective_date': '2024-01-01',
            'change_type': self.change_type, 'authority': 'Station',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)

    def test_cannot_add_record_for_another_stations_officer(self):
        response = self.client_for(self.admin).post('/api/hr/rank-history/', {
            'officer': self.their_officer.pk, 'rank': self.rank.id, 'effective_date': '2024-01-01',
            'change_type': self.change_type, 'authority': 'Station',
        }, format='json')
        self.assertEqual(response.status_code, 403, response.content)

    def test_other_departments_cannot_read_officer_records(self):
        for user in (self.reception, self.nobody):
            with self.subTest(user=user.username):
                self.assertEqual(self.client_for(user).get('/api/hr/dependants/').status_code, 403)
                self.assertEqual(self.client_for(user).get('/api/hr/officers/').status_code, 403)

    def test_reference_lists_are_readable_but_not_editable(self):
        client = self.client_for(self.reception)
        self.assertEqual(client.get('/api/hr/ranks/').status_code, 200)
        self.assertEqual(client.post('/api/hr/ranks/', {'name': 'General', 'rank_level': 9},
                                     format='json').status_code, 403)


class StoresAndFarmsTests(StationIsolationBase):
    def test_module_records_need_the_module(self):
        for url in ('/api/stores/inventory-items/', '/api/stores/stock-ledger/', '/api/farms/livestock-batches/',
                    '/api/farms/farm-revenue/'):
            with self.subTest(url=url):
                self.assertEqual(self.client_for(self.reception).get(url).status_code, 403)
                self.assertEqual(self.client_for(self.nobody).get(url).status_code, 403)
        self.assertEqual(self.client_for(self.farms).get('/api/farms/farm-revenue/').status_code, 200)
