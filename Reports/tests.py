"""
Report Builder: role-based access, station scoping, column choice and order,
filters, sorting, exports and saved reports.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Auth.models import OrgUnit, Station, UserAssignment
from Auth.testing import department, role
from Health.models import Patient
from Reception.models import Inmate, InmateClassificationHistory, Offence
from Reports.models import ReportTemplate

User = get_user_model()


class ReportBuilderTests(TestCase):
    def setUp(self):
        nat = OrgUnit.objects.create(code="NAT", name="National", code_short="NAT", unit_type="NATIONAL_HQ")
        prov = OrgUnit.objects.create(code="MSV", name="Masvingo Province", code_short="MSV",
                                      unit_type="PROVINCIAL_HQ", parent=nat)
        self.chivhu = OrgUnit.objects.create(code="CHV", name="Chivhu Prison", code_short="CHV",
                                             unit_type="STATION", parent=prov)
        self.harare = OrgUnit.objects.create(code="HRE", name="Harare Prison", code_short="HRE",
                                             unit_type="STATION", parent=prov)
        self.chivhu_station = Station.objects.create(code="CHV", name="Chivhu Prison", location="Chivhu")
        self.harare_station = Station.objects.create(code="HRE", name="Harare Prison", location="Harare")
        self.dept = department("ADMINISTRATION")

        self.reception = self.account("1000001A", "RECEPTION_OFFICER", self.chivhu)
        self.health = self.account("1000002A", "HEALTH_OFFICER", self.chivhu)
        self.admin_officer = self.account("1000003A", "ADMIN_OFFICER", self.chivhu)
        self.sys_admin = self.account("1000004A", "STN_SYS_ADMIN", self.chivhu)
        self.reception_harare = self.account("1000005A", "RECEPTION_OFFICER", self.harare)
        self.reception_2 = self.account("1000006A", "RECEPTION_OFFICER", self.chivhu)

        self.zhou = self.inmate("0009/26", "Zhou", "Lovemore", self.chivhu, "C")
        self.makoni = self.inmate("0010/26", "Makoni", "Rutendo", self.chivhu, "B", gender="Female")
        self.far = self.inmate("0001/26", "Banda", "Peter", self.harare, "A")
        Offence.objects.create(inmate=self.zhou, offence_description="House Breaking", court="Gweru",
                               Offence_status="CONVICTED", date_charged=date(2026, 11, 7))
        Patient.objects.create(patient_type="COMMUNITY_MEMBER", full_name="Tsitsi Moyo",
                               gender="Female", station=self.chivhu_station)
        Patient.objects.create(patient_type="COMMUNITY_MEMBER", full_name="John Dube",
                               gender="Male", station=self.harare_station)

    # -- helpers -------------------------------------------------------------
    def account(self, username, role_code, unit):
        user = User.objects.create_user(username=username, password="unused-test-pass")
        role_obj = role(role_code)
        UserAssignment.objects.create(user=user, role=role_obj, org_unit=unit,
                                      department=role_obj.department or self.dept, is_primary=True)
        return user

    def inmate(self, number, surname, first, unit, klass, gender="Male"):
        inmate = Inmate.objects.create(
            prison_number=number, surname=surname, first_name=first, gender=gender,
            date_of_birth=date(1990, 1, 1), nationality="Zimbabwean",
            admission_date=date(2026, 11, 7), owner_org_unit=unit,
        )
        InmateClassificationHistory.objects.create(inmate=inmate, classification=klass,
                                                   effective_date=date(2026, 11, 7))
        return inmate

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def report(self, user, **payload):
        return self.client_for(user).post("/api/reports/run/", payload, format="json")

    def catalogue(self, user):
        return [s["key"] for s in self.client_for(user).get("/api/reports/catalogue/").json()["sources"]]

    # -- role-based access ---------------------------------------------------
    def test_catalogue_lists_only_what_each_role_may_report_on(self):
        self.assertEqual(self.catalogue(self.reception), ["inmates", "offences"])
        self.assertEqual(self.catalogue(self.health), ["patients", "opd_visits", "chronic_patients", "medicines"])
        self.assertEqual(self.catalogue(self.admin_officer), ["inmates", "offences"])
        # System administrators handle accounts, never operational data.
        self.assertEqual(self.catalogue(self.sys_admin), [])

    def test_server_refuses_sources_outside_the_role(self):
        self.assertEqual(self.report(self.reception, source="patients", columns=["full_name"]).status_code, 403)
        self.assertEqual(self.report(self.health, source="inmates", columns=["surname"]).status_code, 403)
        self.assertEqual(self.report(self.sys_admin, source="inmates", columns=["surname"]).status_code, 403)
        export = self.client_for(self.reception).post(
            "/api/reports/export/", {"source": "officers", "columns": ["surname"], "format": "csv"}, format="json")
        self.assertEqual(export.status_code, 403)

    # -- station scoping -----------------------------------------------------
    def test_rows_are_limited_to_the_users_station(self):
        chivhu = self.report(self.reception, source="inmates", columns=["prison_number"]).json()
        self.assertEqual(sorted(r[0] for r in chivhu["rows"]), ["0009/26", "0010/26"])
        harare = self.report(self.reception_harare, source="inmates", columns=["prison_number"]).json()
        self.assertEqual([r[0] for r in harare["rows"]], ["0001/26"])
        patients = self.report(self.health, source="patients", columns=["full_name"]).json()
        self.assertEqual([r[0] for r in patients["rows"]], ["Tsitsi Moyo"])

    # -- columns, order, sort, filters ----------------------------------------
    def test_columns_come_back_in_the_chosen_order_with_labels(self):
        body = self.report(self.reception, source="inmates",
                        columns=["current_class", "surname", "prison_number"],
                        sort=[{"key": "prison_number", "direction": "asc"}]).json()
        self.assertEqual([c["label"] for c in body["columns"]], ["Current Class", "Surname", "Prison Number"])
        self.assertEqual(body["rows"][0], ["C", "Zhou", "0009/26"])
        self.assertEqual(body["total"], 2)

    def test_invalid_columns_are_rejected(self):
        self.assertEqual(self.report(self.reception, source="inmates", columns=[]).status_code, 400)
        self.assertEqual(self.report(self.reception, source="inmates", columns=["surname", "surname"]).status_code, 400)
        self.assertEqual(self.report(self.reception, source="inmates", columns=["password"]).status_code, 400)

    def test_sort_and_filter_on_any_column(self):
        body = self.report(self.reception, source="inmates", columns=["surname"],
                        sort=[{"key": "surname", "direction": "desc"}]).json()
        self.assertEqual([r[0] for r in body["rows"]], ["Zhou", "Makoni"])
        filtered = self.report(self.reception, source="inmates", columns=["surname"], filters={
            "operator": "AND", "conditions": [{"field": "current_class", "operator": "equals", "value": "B"}],
        }).json()
        self.assertEqual([r[0] for r in filtered["rows"]], ["Makoni"])
        bad = self.report(self.reception, source="inmates", columns=["surname"], filters={
            "operator": "AND", "conditions": [{"field": "full_name", "operator": "equals", "value": "x"}],
        })
        self.assertEqual(bad.status_code, 400)

    def test_offences_report_has_one_row_per_offence(self):
        body = self.report(self.reception, source="offences", columns=["prison_number", "offence", "status"]).json()
        self.assertEqual(body["rows"], [["0009/26", "House Breaking", "Convicted"]])

    # -- exports -------------------------------------------------------------
    def test_csv_export_uses_labels_order_and_scope(self):
        response = self.client_for(self.reception).post("/api/reports/export/", {
            "source": "inmates", "columns": ["surname", "prison_number"], "format": "csv", "title": "Chivhu roll",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        lines = response.content.decode("utf-8-sig").strip().splitlines()
        self.assertEqual(lines[0], "Surname,Prison Number")
        self.assertEqual(len(lines), 3)
        self.assertNotIn("Banda", response.content.decode("utf-8-sig"))

    def test_excel_and_pdf_exports(self):
        for fmt, mime in (("excel", "spreadsheetml"), ("pdf", "pdf")):
            response = self.client_for(self.reception).post("/api/reports/export/", {
                "source": "inmates", "columns": ["surname", "admission_date"], "format": fmt,
            }, format="json")
            self.assertEqual(response.status_code, 200, fmt)
            self.assertIn(mime, response["Content-Type"])

    # -- saved reports ---------------------------------------------------------
    def test_saved_reports_respect_role_and_authorship(self):
        client = self.client_for(self.reception)
        saved = client.post("/api/reports/templates/", {
            "name": "Roll", "base_model": "inmates", "selected_fields": ["surname", "prison_number"],
            "filters": {}, "sort": [{"key": "surname", "direction": "asc"}],
        }, format="json")
        self.assertEqual(saved.status_code, 201, saved.content)
        forbidden = client.post("/api/reports/templates/", {
            "name": "Patients", "base_model": "patients", "selected_fields": ["full_name"],
        }, format="json")
        self.assertEqual(forbidden.status_code, 400)

        template_id = saved.json()["id"]
        # Same role sees it but cannot delete it; another role does not see it.
        def ids(c):
            body = c.get("/api/reports/templates/").json()
            return [t["id"] for t in (body["results"] if isinstance(body, dict) else body)]

        colleague = self.client_for(self.reception_2)
        self.assertIn(template_id, ids(colleague))
        self.assertEqual(colleague.delete(f"/api/reports/templates/{template_id}/").status_code, 403)
        health = self.client_for(self.health)
        self.assertNotIn(template_id, ids(health))
        self.assertEqual(client.delete(f"/api/reports/templates/{template_id}/").status_code, 204)
        self.assertFalse(ReportTemplate.objects.exists())
