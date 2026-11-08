"""Organisation structure: org-units API, province/station admin pages, legacy station lookup."""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from Auth.admin import ProvinceForm
from Auth.models import OrgUnit, ProvincialCommandCentre, Station, StationUnit
from Auth.utils import legacy_station_for_unit

User = get_user_model()


class OrgBase(TestCase):
    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National HQ', code_short='NAT', unit_type='NATIONAL_HQ')
        self.east = OrgUnit.objects.create(code='MASH_EAST', name='Mashonaland East', code_short='ME',
                                           unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.south = OrgUnit.objects.create(code='MAT_SOUTH', name='Matabeleland South', code_short='MS',
                                            unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.chivhu = OrgUnit.objects.create(code='CHIVHU', name='Chivhu Prison', code_short='CHV',
                                             unit_type='STATION', parent=self.east)
        self.marondera = OrgUnit.objects.create(code='MARONDERA', name='Marondera Prison', code_short='MRD',
                                                unit_type='STATION', parent=self.east)
        self.closed = OrgUnit.objects.create(code='OLD_STN', name='Closed Prison', code_short='OLD',
                                             unit_type='STATION', parent=self.south, active=False)
        self.user = User.objects.create_user(username='reader', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def names(self, response):
        self.assertEqual(response.status_code, 200, response.content)
        return [row['name'] for row in response.json()]


class OrgUnitApiTests(OrgBase):
    def test_requires_sign_in(self):
        self.assertEqual(APIClient().get('/api/auth/org-units/').status_code, 401)

    def test_lists_provinces_with_station_counts(self):
        r = self.client.get('/api/auth/org-units/?unit_type=PROVINCIAL_HQ')
        self.assertEqual(self.names(r), ['Mashonaland East', 'Matabeleland South'])
        counts = {row['code']: row['station_count'] for row in r.json()}
        self.assertEqual(counts, {'MASH_EAST': 2, 'MAT_SOUTH': 1})

    def test_lists_active_stations_with_their_province(self):
        r = self.client.get('/api/auth/org-units/?unit_type=station')
        self.assertEqual(self.names(r), ['Chivhu Prison', 'Marondera Prison'])
        self.assertEqual({row['parent_name'] for row in r.json()}, {'Mashonaland East'})

    def test_include_inactive(self):
        r = self.client.get('/api/auth/org-units/?unit_type=STATION&include_inactive=1')
        self.assertIn('Closed Prison', self.names(r))

    def test_stations_under_one_province(self):
        r = self.client.get(f'/api/auth/org-units/{self.east.pk}/stations/')
        self.assertEqual(self.names(r), ['Chivhu Prison', 'Marondera Prison'])
        r = self.client.get(f'/api/auth/org-units/?parent={self.east.pk}')
        self.assertEqual(self.names(r), ['Chivhu Prison', 'Marondera Prison'])

    def test_stations_action_rejects_non_province(self):
        r = self.client.get(f'/api/auth/org-units/{self.chivhu.pk}/stations/')
        self.assertEqual(r.status_code, 400)

    def test_search_and_bad_filters(self):
        self.assertEqual(self.names(self.client.get('/api/auth/org-units/?search=chiv')), ['Chivhu Prison'])
        self.assertEqual(self.client.get('/api/auth/org-units/?unit_type=REGION').status_code, 400)
        self.assertEqual(self.client.get('/api/auth/org-units/?parent=abc').status_code, 400)

    def test_read_only(self):
        r = self.client.post('/api/auth/org-units/', {'code': 'X', 'name': 'X'}, format='json')
        self.assertEqual(r.status_code, 405)


class ProxyModelTests(OrgBase):
    def test_proxies_only_see_their_own_type(self):
        self.assertEqual(set(ProvincialCommandCentre.objects.values_list('code', flat=True)), {'MASH_EAST', 'MAT_SOUTH'})
        self.assertEqual(set(StationUnit.objects.values_list('code', flat=True)), {'CHIVHU', 'MARONDERA', 'OLD_STN'})

    def test_new_station_is_linked_to_its_province(self):
        s = StationUnit.objects.create(code='HWAHWA', name='Hwahwa Prison', code_short='HWA', parent=self.east)
        s.refresh_from_db()
        self.assertEqual(s.unit_type, 'STATION')
        self.assertIn(s.pk, self.east.children.values_list('pk', flat=True))

    def test_station_needs_a_province(self):
        with self.assertRaises(ValidationError):
            StationUnit.objects.create(code='LOOSE', name='Loose Prison', code_short='LSE')
        with self.assertRaises(ValidationError):
            StationUnit.objects.create(code='UNDER_HQ', name='Under HQ', code_short='UHQ', parent=self.nat)

    def test_province_form_puts_province_under_national_hq(self):
        form = ProvinceForm(data={'code': 'MIDLANDS', 'name': 'Midlands', 'code_short': 'MID', 'active': True})
        self.assertTrue(form.is_valid(), form.errors)
        p = form.save()
        self.assertEqual((p.unit_type, p.parent_id), ('PROVINCIAL_HQ', self.nat.pk))


# Admin pages render static tags; skip the production manifest in tests.
PLAIN_STATIC = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


# The admin is off by default when DEBUG=False (CI); these tests switch it on.
@override_settings(STORAGES=PLAIN_STATIC, ROOT_URLCONF='Core.urls_admin_on')
class AdminPageTests(OrgBase):
    def setUp(self):
        super().setUp()
        admin = User.objects.create_superuser(username='root', password='x', email='r@example.com')
        self.client.force_login(admin)

    def test_pages_load(self):
        for url in ['/admin/Auth/provincialcommandcentre/', f'/admin/Auth/provincialcommandcentre/{self.east.pk}/change/',
                    '/admin/Auth/stationunit/', f'/admin/Auth/stationunit/?province={self.east.pk}',
                    '/admin/Auth/stationunit/add/', '/admin/Auth/station/']:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_station_list_filters_by_province(self):
        r = self.client.get(f'/admin/Auth/stationunit/?province={self.south.pk}')
        self.assertContains(r, 'Closed Prison')
        self.assertNotContains(r, 'Chivhu Prison')

    def test_legacy_station_table_cannot_be_added_to(self):
        self.assertEqual(self.client.get('/admin/Auth/station/add/').status_code, 403)


class LegacyStationLookupTests(OrgBase):
    def test_matches_by_code_in_any_case_or_by_name(self):
        chivhu = Station.objects.create(code='Chivhu', name='Chivhu Prison')
        marondera = Station.objects.create(code='St Thomas Prison', name='Marondera Prison')
        self.assertEqual(legacy_station_for_unit(self.chivhu), chivhu)
        self.assertEqual(legacy_station_for_unit(self.marondera), marondera)
        self.assertIsNone(legacy_station_for_unit(self.closed))
        self.assertIsNone(legacy_station_for_unit(None))
