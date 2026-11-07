"""
Discharge: approval records status, date and trail; discharged inmates leave the
inmate list and appear in the Discharge Diary for five years.
"""
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from Auth.models import OrgUnit, UserAssignment
from Auth.testing import department, role
from Reception.discharge import diary_start, discharge_inmate
from Reception.models import Inmate, InmateAuditTrail, ReleaseWorkflow
from Reception.serializers import ComprehensiveInmateSerializer

User = get_user_model()


class DischargeTests(TestCase):
    def setUp(self):
        nat = OrgUnit.objects.create(code="NAT", name="National", code_short="NAT", unit_type="NATIONAL_HQ")
        prov = OrgUnit.objects.create(code="MSV", name="Masvingo", code_short="MSV", unit_type="PROVINCIAL_HQ", parent=nat)
        self.chivhu = OrgUnit.objects.create(code="CHV", name="Chivhu Prison", code_short="CHV", unit_type="STATION", parent=prov)
        self.harare = OrgUnit.objects.create(code="HRE", name="Harare Prison", code_short="HRE", unit_type="STATION", parent=prov)
        self.dept = department("ADMINISTRATION")
        self.reception = self.account("1100001A", "RECEPTION_OFFICER", self.chivhu)
        self.admin = self.account("1100002A", "ADMIN_OFFICER", self.chivhu)
        self.health = self.account("1100003A", "HEALTH_OFFICER", self.chivhu)
        self.today = timezone.localdate()

    def account(self, username, role_code, unit):
        user = User.objects.create_user(username=username, password="unused-test-pass")
        role_obj = role(role_code)
        UserAssignment.objects.create(user=user, role=role_obj, org_unit=unit,
                                      department=role_obj.department or self.dept, is_primary=True)
        return user

    def inmate(self, number, unit=None, admitted=date(2024, 1, 10)):
        return Inmate.objects.create(
            prison_number=number, first_name="Test", surname=number.replace("/", ""), gender="Male",
            date_of_birth=date(1990, 1, 1), nationality="Zimbabwean", admission_date=admitted, owner_org_unit=unit,
        )

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def diary(self, user, **params):
        return self.client_for(user).get("/api/reception/discharge-diary/", params)

    # -- approval ------------------------------------------------------------
    def test_admin_approval_discharges_with_date_and_trail(self):
        inmate = self.inmate("0101/26", self.chivhu)
        workflow = ReleaseWorkflow.objects.create(inmate=inmate, reception_reason="Sentence expired")
        response = self.client_for(self.admin).post(
            f"/api/reception/discharge_approvals/{workflow.id}/approve/", {"remarks": "Approved"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        inmate.refresh_from_db()
        self.assertEqual(inmate.current_status, "DISCHARGED")
        self.assertEqual(inmate.discharge_date, self.today)
        self.assertEqual(inmate.discharged_by, "1100002A")
        self.assertTrue(InmateAuditTrail.objects.filter(inmate=inmate, action__startswith="Discharged from custody").exists())

    # -- inmate list ---------------------------------------------------------
    def test_discharged_inmates_leave_the_inmate_list(self):
        # Owner-less legacy rows, so the list's middleware scope includes them in tests.
        staying = self.inmate("0102/26")
        leaving = self.inmate("0103/26")
        discharge_inmate(leaving, self.admin)
        numbers = [r["prison_number"] for r in self.client_for(self.reception).get("/api/reception/inmate-list/").json()]
        self.assertIn(staying.prison_number, numbers)
        self.assertNotIn(leaving.prison_number, numbers)

    # -- diary ---------------------------------------------------------------
    def test_diary_shows_five_years_at_the_users_station(self):
        recent = discharge_inmate(self.inmate("0104/26", self.chivhu), self.admin, when=self.today - timedelta(days=3))
        edge = discharge_inmate(self.inmate("0105/21", self.chivhu, admitted=date(2019, 1, 1)), self.admin,
                                when=diary_start(self.today))
        old = discharge_inmate(self.inmate("0106/20", self.chivhu, admitted=date(2018, 1, 1)), self.admin,
                               when=diary_start(self.today) - timedelta(days=1))
        elsewhere = discharge_inmate(self.inmate("0107/26", self.harare), self.admin, when=self.today)
        in_custody = self.inmate("0108/26", self.chivhu)

        body = self.diary(self.reception).json()
        numbers = [r["prison_number"] for r in body["results"]]
        self.assertEqual(numbers, [recent.prison_number, edge.prison_number])  # newest first
        for excluded in (old, elsewhere, in_custody):
            self.assertNotIn(excluded.prison_number, numbers)
        self.assertEqual(body["window"]["start"], diary_start(self.today).isoformat())
        self.assertEqual(body["summary"]["total"], 2)
        self.assertEqual(len(body["summary"]["by_year"]), 6)  # this year back to the window's first year

    def test_diary_search_and_range_cannot_reach_past_five_years(self):
        discharge_inmate(self.inmate("0109/26", self.chivhu), self.admin, when=self.today)
        old = discharge_inmate(self.inmate("0110/19", self.chivhu, admitted=date(2015, 1, 1)), self.admin,
                               when=self.today - relativedelta(years=6))
        body = self.diary(self.reception, **{"from": "2000-01-01"}).json()
        self.assertEqual(body["range"]["start"], diary_start(self.today).isoformat())
        self.assertNotIn(old.prison_number, [r["prison_number"] for r in body["results"]])
        searched = self.diary(self.reception, search="0109").json()
        self.assertEqual([r["prison_number"] for r in searched["results"]], ["0109/26"])

    def test_diary_needs_reception_access(self):
        self.assertEqual(self.diary(self.health).status_code, 403)
        self.assertEqual(self.diary(self.admin).status_code, 200)

    # -- details -------------------------------------------------------------
    def test_details_report_the_discharge(self):
        inmate = discharge_inmate(self.inmate("0111/26", self.chivhu), self.admin, when=date(2026, 11, 1))
        data = ComprehensiveInmateSerializer(inmate).data
        self.assertEqual((data["current_status"], data["discharge_date"]), ("DISCHARGED", "2026-11-01"))
