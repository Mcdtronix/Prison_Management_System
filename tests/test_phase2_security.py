import os
import json
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, ValidationError

from Auth.models import OrgUnit, Station, Role, Department, UserProfile, UserAssignment, AuditLog
from Auth.permissions import IsStationDataOwner, IsHROfficer, IsStoresOfficer, IsFarmsOfficer
from Auth.utils import (
    get_current_station,
    get_user_operational_context,
    resolve_station_for_org_unit,
    resolve_org_unit_for_station,
)
from Core.filters import OrgUnitAccessFilterBackend
from Core.middleware.audit_logging import AuditLoggingMiddleware
from Health.models import Patient
from Health.views import get_health_queryset_for_user, save_health_record_with_station
from Reception.models import Inmate
from Stores.models import ItemCategory, StockReceipt
from Farms.models import FarmProject
from HumanResources.models import Officer, Rank, OfficerStationHistory

User = get_user_model()


class Phase2SecurityValidationTests(TestCase):
    """
    Focused automated security tests for Phase 2.1 and Phase 2.2 fixes.
    Tests data isolation, cross-station boundaries, mismatched IDs, and tenancy.
    """

    def setUp(self):
        self.factory = RequestFactory()

        # 1. Organization Hierarchy
        self.nat_hq = OrgUnit.objects.create(code='NAT_HQ', name='National HQ', code_short='NHQ', unit_type='NATIONAL_HQ')
        self.prov_hre = OrgUnit.objects.create(code='HRE_PROV', name='Harare Province', code_short='HRE_P', unit_type='PROVINCIAL_HQ', parent=self.nat_hq)
        self.prov_byo = OrgUnit.objects.create(code='BYO_PROV', name='Bulawayo Province', code_short='BYO_P', unit_type='PROVINCIAL_HQ', parent=self.nat_hq)

        # Ensure ID mismatch: create filler stations under Harare province
        self.filler_1 = OrgUnit.objects.create(code='FILL_1', name='Filler 1', code_short='F1', unit_type='STATION', parent=self.prov_hre)
        self.filler_2 = OrgUnit.objects.create(code='FILL_2', name='Filler 2', code_short='F2', unit_type='STATION', parent=self.prov_hre)

        # Station OrgUnits
        self.stn_hre_org = OrgUnit.objects.create(code='HRE_CENT_STN', name='Harare Central Station', code_short='HRE_C', unit_type='STATION', parent=self.prov_hre)
        self.stn_byo_org = OrgUnit.objects.create(code='BYO_CENT_STN', name='Bulawayo Central Station', code_short='BYO_C', unit_type='STATION', parent=self.prov_byo)

        # 2. Station Models (Deliberately mismatched primary keys)
        # Station ID 1 will be Harare Central, but stn_hre_org.id is > 5!
        self.station_hre = Station.objects.create(name='Harare Central', code='HRE_C')
        self.station_byo = Station.objects.create(name='Bulawayo Central', code='BYO_C')

        # 3. Roles and Department
        self.role_super = Role.objects.create(code='SUPER_ADMIN', name='Super Admin')
        self.role_reception = Role.objects.create(code='RECEPTION_OFFICER', name='Reception Officer')
        self.role_hr = Role.objects.create(code='HR_OFFICER', name='HR Officer')
        self.role_health = Role.objects.create(code='HEALTH_OFFICER', name='Health Officer')
        self.role_stores = Role.objects.create(code='STORES_OFFICER', name='Stores Officer')
        self.role_farms = Role.objects.create(code='FARMS_OFFICER', name='Farms Officer')

        self.dept_reception = Department.objects.create(code='RECEPTION', name='Reception')
        self.dept_hr = Department.objects.create(code='HR', name='HR')
        self.dept_health = Department.objects.create(code='HEALTH', name='Health')

        # 4. Users
        # User 1: Legacy user with UserProfile at Harare Central
        self.user_legacy_hre = User.objects.create_user(username='1000001A', password='password')
        UserProfile.objects.create(user=self.user_legacy_hre, role=self.role_reception, station=self.station_hre)

        # User 2: Multi-tenant user with UserAssignment at Bulawayo Central
        self.user_assign_byo = User.objects.create_user(username='2000002B', password='password')
        UserAssignment.objects.create(
            user=self.user_assign_byo,
            role=self.role_reception,
            org_unit=self.stn_byo_org,
            department=self.dept_reception,
            is_primary=True,
            is_active=True
        )

        # User 3: National HQ Administrator (no station)
        self.user_hq = User.objects.create_user(username='9000009Z', password='password')
        UserAssignment.objects.create(
            user=self.user_hq,
            role=self.role_super,
            org_unit=self.nat_hq,
            department=self.dept_hr,
            is_primary=True,
            is_active=True
        )

        # User 4: Superuser
        self.user_superuser = User.objects.create_superuser(username='admin', password='password', email='admin@pms.co.zw')

    def test_mismatched_primary_key_resolution(self):
        """
        Verify that Station and OrgUnit ID mismatches do not cause false positives or false negatives.
        Station ID 1 (Harare) != OrgUnit ID (stn_hre_org.id).
        """
        self.assertNotEqual(self.station_hre.id, self.stn_hre_org.id)

        # Check mapping functions
        mapped_org = resolve_org_unit_for_station(self.station_hre)
        self.assertEqual(mapped_org.id, self.stn_hre_org.id)

        mapped_stn = resolve_station_for_org_unit(self.stn_hre_org)
        self.assertEqual(mapped_stn.id, self.station_hre.id)

        # Check operational context
        req = self.factory.get('/api/test/')
        req.user = self.user_legacy_hre
        org_unit, station = get_user_operational_context(req)
        self.assertEqual(org_unit.id, self.stn_hre_org.id)
        self.assertEqual(station.id, self.station_hre.id)

    def test_cross_station_access_denied_object_permission(self):
        """
        Verify that IsStationDataOwner denies a Harare user from accessing a Bulawayo record.
        """
        permission = IsStationDataOwner()
        req = self.factory.get('/api/reception/inmates/1/')
        req.user = self.user_legacy_hre

        # Target object belongs to Bulawayo
        byo_inmate = Inmate.objects.create(
            first_name='Bulawayo',
            surname='Prisoner',
            prison_number='0001/25',
            date_of_birth='1990-01-01',
            gender='Male',
            nationality='Zimbabwean',
            owner_org_unit=self.stn_byo_org
        )

        # Must raise PermissionDenied with STATION_MISMATCH
        with self.assertRaises(PermissionDenied):
            permission.has_object_permission(req, None, byo_inmate)

    def test_unassigned_record_hidden_from_station_user(self):
        """
        Verify that an unassigned record (owner_org_unit=None) is rejected for station users
        and accessible for National HQ users.
        """
        permission = IsStationDataOwner()

        unassigned_inmate = Inmate.objects.create(
            first_name='Unassigned',
            surname='Prisoner',
            prison_number='0002/25',
            date_of_birth='1992-02-02',
            gender='Male',
            nationality='Zimbabwean',
            owner_org_unit=None
        )

        # Station user: access denied
        req_stn = self.factory.get('/api/reception/inmates/unassigned/')
        req_stn.user = self.user_legacy_hre
        with self.assertRaises(PermissionDenied):
            permission.has_object_permission(req_stn, None, unassigned_inmate)

        # National HQ user: access allowed for triage
        req_hq = self.factory.get('/api/reception/inmates/unassigned/')
        req_hq.user = self.user_hq
        self.assertTrue(permission.has_object_permission(req_hq, None, unassigned_inmate))

    def test_core_filter_backend_null_policy(self):
        """
        Verify OrgUnitAccessFilterBackend hides null records from station users
        while preserving null records for global catalogs and National HQ.
        """
        filter_backend = OrgUnitAccessFilterBackend()

        # Operational Inmate
        stn_inmate = Inmate.objects.create(
            first_name='Harare',
            surname='Prisoner',
            prison_number='0003/25',
            date_of_birth='1993-03-03',
            gender='Male',
            nationality='Zimbabwean',
            owner_org_unit=self.stn_hre_org
        )
        null_inmate = Inmate.objects.create(
            first_name='Null',
            surname='Prisoner',
            prison_number='0004/25',
            date_of_birth='1994-04-04',
            gender='Male',
            nationality='Zimbabwean',
            owner_org_unit=None
        )

        # Station user request with visible_org_units
        req = self.factory.get('/api/reception/inmates/')
        req.user = self.user_legacy_hre
        req.org_unit = self.stn_hre_org
        req.visible_org_units = OrgUnit.objects.filter(id=self.stn_hre_org.id)

        filtered_qs = filter_backend.filter_queryset(req, Inmate.objects.all(), None)
        inmate_ids = list(filtered_qs.values_list('id', flat=True))

        self.assertIn(stn_inmate.id, inmate_ids)
        self.assertNotIn(null_inmate.id, inmate_ids)

        # National HQ user can see both
        req_hq = self.factory.get('/api/reception/inmates/')
        req_hq.user = self.user_hq
        req_hq.org_unit = self.nat_hq
        req_hq.visible_org_units = OrgUnit.objects.all()

        filtered_hq_qs = filter_backend.filter_queryset(req_hq, Inmate.objects.all(), None)
        hq_inmate_ids = list(filtered_hq_qs.values_list('id', flat=True))
        self.assertIn(stn_inmate.id, hq_inmate_ids)
        self.assertIn(null_inmate.id, hq_inmate_ids)

    def test_audit_logging_middleware_hq_user_mutation(self):
        """
        Verify AuditLoggingMiddleware creates an AuditLog record for National HQ mutations
        even though station is None.
        """
        middleware = AuditLoggingMiddleware(lambda r: None)

        req = self.factory.post('/api/hr/officers/', data=json.dumps({"first_name": "Test"}), content_type='application/json')
        req.user = self.user_hq
        req.org_unit = self.nat_hq
        middleware.process_request(req)

        from django.http import HttpResponse
        response = HttpResponse(status=201)

        initial_count = AuditLog.objects.count()
        middleware.process_response(req, response)
        self.assertEqual(AuditLog.objects.count(), initial_count + 1)

        latest_log = AuditLog.objects.latest('timestamp')
        self.assertEqual(latest_log.user, self.user_hq)
        self.assertIsNone(latest_log.station)
        self.assertIn('OrgUnit: NAT_HQ', latest_log.remarks)

    def test_audit_logging_masks_credentials(self):
        """
        Verify AuditLoggingMiddleware masks password fields in request body.
        """
        middleware = AuditLoggingMiddleware(lambda r: None)
        req = self.factory.post('/api/auth/token/', data=json.dumps({"username": "admin", "password": "SuperSecretPassword123"}), content_type='application/json')
        body = middleware._get_request_body(req)
        self.assertNotIn("SuperSecretPassword123", body)
        self.assertIn("******", body)

    def test_health_views_dual_tenancy_no_500(self):
        """
        Verify Health queryset helper handles a user with UserAssignment only
        without raising RelatedObjectDoesNotExist.
        """
        # User has NO userprofile, only UserAssignment
        req = self.factory.get('/api/health/patients/')
        req.user = self.user_assign_byo
        req.org_unit = self.stn_byo_org

        # Should not crash with AttributeError or RelatedObjectDoesNotExist
        station = get_current_station(self.user_assign_byo)
        self.assertEqual(station, self.station_byo)

        qs = get_health_queryset_for_user(req, Patient.objects.all(), station_field="station")
        self.assertIsNotNone(qs)

    def test_stores_prevent_unauthorized_reassignment(self):
        """
        Verify that a stores user cannot assign a stock receipt to an unauthorized org unit.
        """
        from Stores.views import StockReceiptViewSet
        view = StockReceiptViewSet()
        req = self.factory.post('/api/stores/receipts/')
        req.user = self.user_legacy_hre
        req.org_unit = self.stn_hre_org
        req.visible_org_units = OrgUnit.objects.filter(id=self.stn_hre_org.id)
        view.request = req

        # Attempting to assign to Bulawayo station
        class DummySerializer:
            validated_data = {'receiving_org_unit': self.stn_byo_org}
            def save(self, **kwargs):
                pass

        with self.assertRaises(PermissionDenied):
            view.perform_create(DummySerializer())

    def test_farms_prevent_unauthorized_reassignment(self):
        """
        Verify that a farms user cannot assign a farm project to an unauthorized org unit.
        """
        from Farms.views import FarmProjectViewSet
        view = FarmProjectViewSet()
        req = self.factory.post('/api/farms/projects/')
        req.user = self.user_legacy_hre
        req.org_unit = self.stn_hre_org
        req.visible_org_units = OrgUnit.objects.filter(id=self.stn_hre_org.id)
        view.request = req

        class DummySerializer:
            validated_data = {'owner_org_unit': self.stn_byo_org}
            def save(self, **kwargs):
                pass

        with self.assertRaises(PermissionDenied):
            view.perform_create(DummySerializer())

    def test_hr_officer_permissions(self):
        """
        Verify IsHROfficer allows HR officers and admins, but rejects reception-only officers.
        """
        req_hr = self.factory.get('/api/hr/officers/')
        req_hr.user = self.user_hq

        req_reception = self.factory.get('/api/hr/officers/')
        req_reception.user = self.user_legacy_hre

        permission = IsHROfficer()
        self.assertTrue(permission.has_permission(req_hr, None))
        self.assertFalse(permission.has_permission(req_reception, None))
