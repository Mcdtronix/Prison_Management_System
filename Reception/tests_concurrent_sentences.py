"""
Concurrent and consecutive counts: the same rule through offence registration
and Record Court Outcome.

Scenario from the field: three counts sentenced on 07 Nov 2026 -
count 1: 36 months, count 2: 24 months concurrent with count 1,
count 3: 12 months consecutive. Effective sentence = 36 + 12 = 48 months.
"""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import serializers as drf_serializers
from rest_framework.test import APIClient

from Reception.models import (
    Convicted, Inmate, Offence, ReleaseHistory, SentenceGroup, Unconvicted,
)
from Reception.sentencing import concurrent_offence_ids, set_concurrency
from Reception.serializers import ComprehensiveInmateSerializer, OffenceRegistrationSerializer

SENTENCED = date(2026, 11, 7)
# 48 months from 07 Nov 2026 = 1461 days; remission 487; 974 days to serve.
EXPECTED_48 = dict(days=1461, remission=487, months=48, edr=date(2029, 7, 7), odr=date(2030, 11, 6))
# All three consecutive = 72 months = 2192 days.
EXPECTED_72 = dict(days=2192, remission=730, months=72, edr=date(2030, 11, 7), odr=date(2032, 11, 6))


class Base(TestCase):
    def setUp(self):
        self.inmate = Inmate.objects.create(
            first_name="Tinashe", surname="Moyo", prison_number="0090/26",
            admission_date=SENTENCED, date_of_birth=date(1993, 3, 14),
            gender="Male", nationality="Zimbabwean",
        )

    def history(self):
        return ReleaseHistory.objects.get(inmate=self.inmate)

    def assertSentence(self, expected):
        h = self.history()
        self.assertEqual(
            (h.total_sentences_days, h.total_remission_days, h.total_effective_sentence, h.edr_standard, h.odr_standard),
            (expected["days"], expected["remission"], expected["months"], expected["edr"], expected["odr"]),
        )


class SentencingRuleTests(Base):
    def convict(self, description, years):
        offence = Offence.objects.create(
            inmate=self.inmate, offence_description=description, court="Gweru Regional",
            Offence_status="CONVICTED", date_charged=SENTENCED,
        )
        return Convicted.objects.create(
            prison_number=self.inmate, offence=offence, date_of_sentence=SENTENCED, sentence_years=years,
        )

    def setUp(self):
        super().setUp()
        self.c1 = self.convict("Count 1 - Robbery", 3)
        self.c2 = self.convict("Count 2 - Unlawful Entry", 2)
        self.c3 = self.convict("Count 3 - Theft", 1)

    def test_all_consecutive_by_default(self):
        self.assertSentence(EXPECTED_72)

    def test_two_concurrent_then_one_consecutive_is_48_months(self):
        set_concurrency(self.c2, self.c1)
        self.assertSentence(EXPECTED_48)
        self.assertEqual(concurrent_offence_ids(self.c1), [self.c2.offence_id])
        self.assertEqual(concurrent_offence_ids(self.c3), [])

    def test_linking_to_a_grouped_count_joins_that_group(self):
        set_concurrency(self.c2, self.c1)
        set_concurrency(self.c3, self.c2)
        self.assertEqual(SentenceGroup.objects.filter(inmate=self.inmate).count(), 1)
        self.assertEqual(self.history().total_effective_sentence, 36)

    def test_unlinking_restores_consecutive_and_removes_empty_group(self):
        set_concurrency(self.c2, self.c1)
        set_concurrency(self.c2, None)
        self.assertSentence(EXPECTED_72)
        self.assertFalse(SentenceGroup.objects.filter(inmate=self.inmate).exists())

    def test_a_count_cannot_run_concurrently_with_itself(self):
        with self.assertRaises(drf_serializers.ValidationError):
            set_concurrency(self.c1, self.c1)

    def test_details_api_reports_the_link(self):
        set_concurrency(self.c2, self.c1)
        offences = {o["id"]: o for o in ComprehensiveInmateSerializer(self.inmate).data["offences"]}
        self.assertEqual(offences[self.c1.offence_id]["concurrent_with"], [self.c2.offence_id])
        self.assertEqual(offences[self.c2.offence_id]["concurrent_with"], [self.c1.offence_id])
        self.assertEqual(offences[self.c3.offence_id]["concurrent_with"], [])


class OffenceRegistrationTests(Base):
    def register(self, links):
        counts = [("Count 1 - Robbery", 3), ("Count 2 - Unlawful Entry", 2), ("Count 3 - Theft", 1)]
        payload = {
            "inmate_id": self.inmate.id,
            "offences": [
                {
                    "offence": name, "court": "Gweru Regional", "convictionStatus": "convicted",
                    "sentenceYears": years, "sentenceDate": "2026-11-07", "concurrentWith": links[i],
                }
                for i, (name, years) in enumerate(counts)
            ],
        }
        serializer = OffenceRegistrationSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_registration_with_counts_one_and_two_concurrent(self):
        self.register(["", "new:0", ""])
        self.assertSentence(EXPECTED_48)

    def test_registration_rejects_a_count_linked_to_itself(self):
        with self.assertRaises(drf_serializers.ValidationError):
            self.register(["", "new:1", ""])

    def test_registration_can_link_to_a_count_already_on_record(self):
        self.register(["", "", ""])
        count_1 = Offence.objects.get(inmate=self.inmate, offence_description="Count 1 - Robbery")
        payload = {
            "inmate_id": self.inmate.id,
            "offences": [{
                "offence": "Count 4 - Fraud", "court": "Gweru Regional", "convictionStatus": "convicted",
                "sentenceYears": 2, "sentenceDate": "2026-11-07", "concurrentWith": f"existing:{count_1.id}",
            }],
        }
        serializer = OffenceRegistrationSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        # 3y (with the concurrent 2y) + 2y + 1y = 72 months, not 96.
        self.assertEqual(self.history().total_effective_sentence, 72)


class CourtOutcomeTests(Base):
    """Remand inmate: three counts, convicted one by one through Record Court Outcome."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_superuser("9000009Z", password="unused-test-pass"))
        self.counts = []
        for name in ("Count 1 - Robbery", "Count 2 - Unlawful Entry", "Count 3 - Theft"):
            offence = Offence.objects.create(
                inmate=self.inmate, offence_description=name, court="Gweru Regional",
                Offence_status="UNCONVICTED", date_charged=SENTENCED,
            )
            Unconvicted.objects.create(
                prison_number=self.inmate, offence=offence,
                remand_start_date=SENTENCED, next_court_date=date(2026, 11, 20),
            )
            self.counts.append(offence)

    def convict(self, offence, years, concurrent_with=None):
        response = self.client.post(
            f"/api/reception/offences/{offence.id}/record_court_session/",
            {"session_date": "2026-11-07", "outcome": "CONVICTED", "sentence_years": years,
             "sentence_date": "2026-11-07", "concurrent_with_offence_id": concurrent_with},
            format="json",
        )
        return response

    def test_remand_counts_sentenced_one_concurrent_one_consecutive(self):
        c1, c2, c3 = self.counts
        for offence, years, link in ((c1, 3, None), (c2, 2, c1.id), (c3, 1, None)):
            response = self.convict(offence, years, link)
            self.assertIn(response.status_code, (200, 201), response.content)
        self.assertSentence(EXPECTED_48)

    def test_rejects_link_to_an_unconvicted_count(self):
        c1, c2, _ = self.counts
        response = self.convict(c2, 2, c1.id)  # count 1 is still on remand
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Offence.objects.get(id=c2.id).Offence_status, "UNCONVICTED")


class CourtMatterTests(CourtOutcomeTests):
    """Record Court Outcome / scheduling only while a court matter is pending."""

    def test_sentenced_count_without_restitution_is_locked(self):
        c1 = self.counts[0]
        self.assertIn(self.convict(c1, 3).status_code, (200, 201))
        again = self.convict(c1, 2)
        self.assertEqual(again.status_code, 400, again.content)
        self.assertIn("no court matter pending", again.json()["error"])
        self.assertEqual(Convicted.objects.get(offence=c1).sentence_years, 3)

    def test_sentenced_count_with_unpaid_restitution_stays_open(self):
        from Reception.models import Restitution
        c1 = self.counts[0]
        self.convict(c1, 3)
        Restitution.objects.create(
            inmate=self.inmate, offence=c1, restitution_amount=500,
            restitution_date=date(2026, 11, 30), status="pending",
        )
        self.assertIn(self.convict(c1, 3).status_code, (200, 201))

    def test_scheduling_a_session_needs_a_pending_matter(self):
        c1, c2, _ = self.counts
        self.convict(c1, 3)
        from django.core.files.uploadedfile import SimpleUploadedFile

        def schedule(offence):
            warrant = SimpleUploadedFile("warrant.pdf", b"%PDF-1.4 test", content_type="application/pdf")
            return self.client.post(
                "/api/reception/court-sessions/schedule/",
                {"offence_id": offence.id, "next_court_date": "2026-12-01", "warrant_document": warrant},
                format="multipart",
            )

        locked = schedule(c1)
        self.assertEqual(locked.status_code, 400, locked.content)
        self.assertIn("no court matter pending", locked.json()["error"])
        self.assertLess(schedule(c2).status_code, 300)
