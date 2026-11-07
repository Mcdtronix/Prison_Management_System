"""
Confirmation of sentence: endorsed, reduced or increased.

Count sentenced 36 months on 07 Nov 2026. A reduction or increase schedules a
court session; the revised sentence is applied when that session's outcome is
recorded, and still runs from 07 Nov 2026 for remission.
"""
import shutil
import tempfile
from datetime import date

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from Reception.models import (
    Convicted, CourtSession, Inmate, InmateAuditTrail, Offence, ReleaseHistory, SentenceConfirmation,
)
from Reception.serializers import ComprehensiveInmateSerializer

SENTENCED = date(2026, 11, 7)
MEDIA = tempfile.mkdtemp()


def document():
    return SimpleUploadedFile("confirmation.pdf", b"%PDF-1.4 confirmation", content_type="application/pdf")


@override_settings(MEDIA_ROOT=MEDIA)
class SentenceConfirmationTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_superuser("9000010A", password="unused-test-pass"))
        self.inmate = Inmate.objects.create(
            first_name="Lovemore", surname="Zhou", prison_number="0091/26",
            admission_date=SENTENCED, date_of_birth=date(1991, 10, 16),
            gender="Male", nationality="Zimbabwean",
        )
        self.offence = Offence.objects.create(
            inmate=self.inmate, offence_description="House Breaking", court="Gweru Magistrates",
            Offence_status="CONVICTED", date_charged=SENTENCED,
        )
        Convicted.objects.create(
            prison_number=self.inmate, offence=self.offence, date_of_sentence=SENTENCED, sentence_years=3,
        )

    # -- helpers -------------------------------------------------------------
    def confirm(self, outcome, court_date=None, with_document=True, confirmation_date="2026-11-07"):
        payload = {"outcome": outcome, "confirmation_date": confirmation_date, "remarks": "High Court review"}
        if court_date:
            payload["court_date"] = court_date
        if with_document:
            payload["document"] = document()
        return self.client.post(
            f"/api/reception/offences/{self.offence.id}/confirm_sentence/", payload, format="multipart"
        )

    def resentence(self, years, session="2026-12-10"):
        return self.client.post(
            f"/api/reception/offences/{self.offence.id}/record_court_session/",
            {"session_date": session, "outcome": "CONVICTED", "sentence_years": years, "sentence_date": session},
            format="json",
        )

    def history(self):
        return ReleaseHistory.objects.get(inmate=self.inmate)

    def audit(self):
        return list(InmateAuditTrail.objects.filter(inmate=self.inmate).values_list("action", flat=True))

    # -- endorsed ------------------------------------------------------------
    def test_endorsed_closes_without_a_court_session(self):
        response = self.confirm("ENDORSED")
        self.assertEqual(response.status_code, 201, response.content)
        confirmation = SentenceConfirmation.objects.get()
        self.assertEqual(confirmation.status, SentenceConfirmation.COMPLETED)
        self.assertIsNone(confirmation.court_session)
        self.assertFalse(CourtSession.objects.filter(offence=self.offence).exists())
        self.assertEqual(self.history().total_effective_sentence, 36)
        self.assertTrue(any("sentence endorsed" in a for a in self.audit()))
        # Nothing left before the court.
        self.assertEqual(self.resentence(2).status_code, 400)

    # -- validation ----------------------------------------------------------
    def test_document_is_mandatory(self):
        response = self.confirm("ENDORSED", with_document=False)
        self.assertEqual(response.status_code, 400)
        self.assertIn("document", response.json())

    def test_reduction_needs_a_court_date(self):
        response = self.confirm("REDUCED")
        self.assertEqual(response.status_code, 400)
        self.assertIn("court_date", response.json())

    def test_only_one_confirmation_can_await_court(self):
        self.assertEqual(self.confirm("REDUCED", "2026-12-10").status_code, 201)
        self.assertEqual(self.confirm("INCREASED", "2026-12-11").status_code, 400)

    # -- reduced -------------------------------------------------------------
    def test_reduction_schedules_court_then_applies_from_original_date(self):
        self.assertEqual(self.confirm("REDUCED", "2026-12-10").status_code, 201)
        confirmation = SentenceConfirmation.objects.get()
        self.assertEqual(confirmation.status, SentenceConfirmation.AWAITING_COURT)
        self.assertEqual(confirmation.court_session.session_date, date(2026, 12, 10))
        self.assertEqual(confirmation.court_session.outcome, "SCHEDULED")
        # Sentence unchanged until the court session.
        self.assertEqual(self.history().total_effective_sentence, 36)

        response = self.resentence(2)
        self.assertIn(response.status_code, (200, 201), response.content)

        conviction = Convicted.objects.get(offence=self.offence)
        self.assertEqual(conviction.sentence_years, 2)
        self.assertEqual(conviction.date_of_sentence, SENTENCED)  # not the session date
        h = self.history()
        # 24 months from 07 Nov 2026 = 731 days (2028 is a leap year); remission 243.
        self.assertEqual((h.total_effective_sentence, h.total_sentences_days, h.total_remission_days), (24, 731, 243))
        self.assertEqual(h.odr_standard, date(2028, 11, 6))

        confirmation.refresh_from_db()
        self.assertEqual(confirmation.status, SentenceConfirmation.APPLIED)
        self.assertEqual(
            (confirmation.revised_sentence_years, confirmation.previous_sentence_years), (2, 3)
        )
        self.assertEqual(confirmation.court_session.outcome, "CONVICTED")
        self.assertEqual(CourtSession.objects.filter(offence=self.offence).count(), 1)
        self.assertTrue(any("Sentence reduced from 3y 0m 0d to 2y 0m 0d" in a for a in self.audit()))
        self.assertTrue(any("Court session scheduled" in a for a in self.audit()))

    def test_reduction_rejects_a_longer_sentence(self):
        self.confirm("REDUCED", "2026-12-10")
        response = self.resentence(4)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Convicted.objects.get(offence=self.offence).sentence_years, 3)
        self.assertEqual(SentenceConfirmation.objects.get().status, SentenceConfirmation.AWAITING_COURT)

    # -- increased -----------------------------------------------------------
    def test_increase_applies_from_original_date(self):
        self.confirm("INCREASED", "2026-12-10")
        self.assertIn(self.resentence(4).status_code, (200, 201))
        h = self.history()
        self.assertEqual(h.total_effective_sentence, 48)
        self.assertEqual(h.odr_standard, date(2030, 11, 6))
        self.assertTrue(any("Sentence increased from 3y 0m 0d to 4y 0m 0d" in a for a in self.audit()))

    def test_increase_rejects_a_shorter_sentence(self):
        self.confirm("INCREASED", "2026-12-10")
        self.assertEqual(self.resentence(2).status_code, 400)

    def test_only_a_resentence_can_answer_a_pending_confirmation(self):
        self.confirm("REDUCED", "2026-12-10")
        response = self.client.post(
            f"/api/reception/offences/{self.offence.id}/record_court_session/",
            {"session_date": "2026-12-10", "outcome": "DISCHARGED", "discharge_reason": "ACQUITTED"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    # -- details API ---------------------------------------------------------
    def test_details_api_lists_history_and_pending(self):
        self.confirm("REDUCED", "2026-12-10")
        offence = ComprehensiveInmateSerializer(self.inmate).data["offences"][0]
        self.assertEqual(offence["pending_confirmation"]["outcome"], "REDUCED")
        self.assertEqual(offence["pending_confirmation"]["court_date"], date(2026, 12, 10))
        self.assertEqual(len(offence["confirmations"]), 1)
        self.assertTrue(offence["confirmations"][0]["document"])

    def test_trail_appears_on_the_inmate_timeline(self):
        self.confirm("REDUCED", "2026-12-10")
        self.resentence(2)
        timeline = ComprehensiveInmateSerializer(self.inmate).data["timeline"]
        trail = [e["description"] for e in timeline if e["event_type"] == "Sentence & Court"]
        self.assertTrue(any(t.startswith("Confirmation of sentence recorded") for t in trail))
        self.assertTrue(any(t.startswith("Court session scheduled") for t in trail))
        self.assertTrue(any(t.startswith("Sentence reduced from 3y 0m 0d to 2y 0m 0d") for t in trail))
