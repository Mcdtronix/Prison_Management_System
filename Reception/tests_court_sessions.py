"""
Court sessions: dates cannot precede the matter, and scheduled sessions are
settled once an outcome is recorded, so the Courts calendar stays accurate.

Remanded 07 Nov 2026, next court 20 Nov 2026.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from Health.models import OutPatientVisit
from Reception.models import CourtSession, Inmate, Offence, Unconvicted
from Reception.serializers import ComprehensiveInmateSerializer

REMANDED = date(2026, 11, 7)
COURT = date(2026, 11, 20)


class CourtSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_superuser("9000020A", password="unused-test-pass"))
        self.inmate = Inmate.objects.create(
            first_name="Gift", surname="Muzondo", prison_number="0095/26",
            admission_date=REMANDED, date_of_birth=date(1995, 3, 2), gender="Male", nationality="Zimbabwean",
        )
        self.offence = Offence.objects.create(
            inmate=self.inmate, offence_description="Criminal Nuisance", court="Harare Magistrates",
            Offence_status="UNCONVICTED", date_charged=REMANDED,
        )
        Unconvicted.objects.create(
            prison_number=self.inmate, offence=self.offence, remand_start_date=REMANDED, next_court_date=COURT,
        )
        self.scheduled = CourtSession.objects.create(
            offence=self.offence, session_date=COURT, outcome="SCHEDULED", next_court_date=COURT,
        )

    def record(self, **payload):
        return self.client.post(
            f"/api/reception/offences/{self.offence.id}/record_court_session/", payload, format="json")

    def upcoming(self):
        return [row["id"] for row in self.client.get("/api/reception/court-sessions/upcoming/").json()]

    # -- dates ---------------------------------------------------------------
    def test_session_before_remand_start_is_rejected(self):
        response = self.record(session_date="2026-11-01", outcome="DISCHARGED", discharge_reason="BAIL")
        self.assertEqual(response.status_code, 400)
        self.assertIn("07/11/2026", response.json()["session_date"][0])
        self.offence.refresh_from_db()
        self.assertEqual(self.offence.Offence_status, "UNCONVICTED")

    def test_sentence_before_remand_start_is_rejected(self):
        response = self.record(session_date="2026-11-20", outcome="CONVICTED", sentence_months=6,
                               sentence_date="2026-11-01")
        self.assertEqual(response.status_code, 400)
        self.assertIn("sentence_date", response.json())

    def test_session_on_remand_start_is_allowed(self):
        response = self.record(session_date="2026-11-07", outcome="DISCHARGED", discharge_reason="BAIL")
        self.assertEqual(response.status_code, 200, response.content)

    # -- scheduled sessions --------------------------------------------------
    def test_outcome_on_the_scheduled_day_answers_that_session(self):
        self.assertIn(self.scheduled.id, self.upcoming())
        self.assertEqual(self.record(session_date="2026-11-20", outcome="DISCHARGED",
                                     discharge_reason="BAIL").status_code, 200)
        self.scheduled.refresh_from_db()
        self.assertEqual(self.scheduled.outcome, "DISCHARGED")
        self.assertEqual(CourtSession.objects.filter(offence=self.offence).count(), 1)
        self.assertEqual(self.upcoming(), [])

    def test_discharge_cancels_later_scheduled_sessions(self):
        later = CourtSession.objects.create(offence=self.offence, session_date=date(2026, 12, 4),
                                            outcome="SCHEDULED", next_court_date=date(2026, 12, 4))
        self.assertEqual(self.record(session_date="2026-11-10", outcome="DISCHARGED",
                                     discharge_reason="BAIL").status_code, 200)
        for session in (self.scheduled, later):
            session.refresh_from_db()
            self.assertEqual(session.outcome, "CANCELLED")
            self.assertIsNone(session.next_court_date)
        self.assertEqual(self.upcoming(), [])

    def test_remand_keeps_later_sessions_and_supersedes_earlier_ones(self):
        later = CourtSession.objects.create(offence=self.offence, session_date=date(2026, 12, 4),
                                            outcome="SCHEDULED", next_court_date=date(2026, 12, 4))
        self.assertEqual(self.record(session_date="2026-11-20", outcome="REMANDED",
                                     next_court_date="2026-12-04").status_code, 200)
        later.refresh_from_db()
        self.assertEqual(later.outcome, "SCHEDULED")
        self.assertIn(later.id, self.upcoming())

    def test_old_remand_date_leaves_calendar_once_a_later_outcome_is_recorded(self):
        self.record(session_date="2026-11-20", outcome="REMANDED", next_court_date="2026-12-04")
        remand = CourtSession.objects.get(offence=self.offence, outcome="REMANDED")
        self.assertIn(remand.id, self.upcoming())
        self.record(session_date="2026-12-04", outcome="DISCHARGED", discharge_reason="ACQUITTED")
        self.assertEqual(self.upcoming(), [])

    def test_cancelled_cannot_be_recorded_by_hand(self):
        response = self.record(session_date="2026-11-20", outcome="CANCELLED")
        self.assertEqual(response.status_code, 400)
        self.assertIn("outcome", response.json())

    # -- details -------------------------------------------------------------
    def test_details_report_discharged_status(self):
        self.record(session_date="2026-11-20", outcome="DISCHARGED", discharge_reason="BAIL")
        offence = ComprehensiveInmateSerializer(self.inmate).data["offences"][0]
        self.assertEqual(offence["conviction_status"], "discharged")


class OpdTemperatureTests(SimpleTestCase):
    def test_normal_temperature_is_accepted_and_limits_hold(self):
        field = OutPatientVisit._meta.get_field("temperature")
        field.clean(Decimal("37.0"), None)
        for bad in (Decimal("29.9"), Decimal("45.1")):
            with self.assertRaises(ValidationError):
                field.clean(bad, None)
