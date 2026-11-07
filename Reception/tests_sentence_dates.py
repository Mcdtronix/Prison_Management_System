"""Sentence length, remission and release dates use calendar days, sentence date = day one."""
from datetime import date

from django.test import TestCase

from Reception.models import Convicted, Inmate, Offence, ReleaseHistory, Restitution
from Reception.serializers import ComprehensiveInmateSerializer

SENTENCED = date(2026, 11, 7)


class SentenceDateTests(TestCase):
    def setUp(self):
        self.inmate = Inmate.objects.create(
            first_name="Test", surname="Inmate", prison_number="0099/26",
            admission_date=SENTENCED, date_of_birth=date(1990, 1, 1),
            gender="Male", nationality="Zimbabwean",
        )
        self.offence = Offence.objects.create(
            inmate=self.inmate, offence_description="Test", court="Gweru",
            Offence_status="CONVICTED", date_charged=SENTENCED,
        )

    def convict(self, years=0, months=0, days=0, **extra):
        conviction = Convicted.objects.create(
            prison_number=self.inmate, offence=self.offence, date_of_sentence=SENTENCED,
            sentence_years=years, sentence_months=months, sentence_days=days, **extra,
        )
        return conviction, ReleaseHistory.objects.get(inmate=self.inmate)

    def test_sixty_days_is_sixty_days(self):
        conviction, history = self.convict(days=60)
        self.assertEqual((conviction.effective_sentence_days, conviction.remission_days), (60, 20))
        self.assertEqual((history.total_sentences_days, history.total_remission_days), (60, 20))
        self.assertEqual(history.odr_standard, date(2027, 1, 5))   # day 60
        self.assertEqual(history.edr_standard, date(2026, 12, 16))  # day 40

    def test_eighteen_months_edr_is_odr_less_remission(self):
        conviction, history = self.convict(years=1, months=6)
        self.assertEqual((conviction.effective_sentence_days, conviction.remission_days), (547, 182))
        self.assertEqual(history.odr_standard, date(2028, 5, 6))
        self.assertEqual(history.edr_standard, date(2027, 11, 6))
        self.assertEqual((history.odr_standard - history.edr_standard).days, history.total_remission_days)

    def test_restitution_paid_dates_follow_the_same_rule(self):
        self.convict(years=2)
        Restitution.objects.create(
            inmate=self.inmate, offence=self.offence, restitution_amount=1800,
            restitution_date=date(2026, 11, 30), restitution_sentence_months=4, status="pending",
        )
        history = ReleaseHistory.objects.get(inmate=self.inmate)
        # 2 years from 07 Nov 2026 = 731 days (2028 is a leap year); paying remits 4 x 30 = 120.
        self.assertEqual(history.total_sentences_days, 731)
        # Net 611 days: ODR is day 611 (09 Jul 2028); 611 - 203 remission = day 408 (19 Dec 2027).
        self.assertEqual(history.odr_restitution_paid, date(2028, 7, 9))
        self.assertEqual(history.edr_restitution_paid, date(2027, 12, 19))

    def test_fine_and_bail_reach_the_details_api(self):
        self.convict(days=60, has_fine=True, fine_amount=50)
        remand = Offence.objects.create(
            inmate=self.inmate, offence_description="Nuisance", court="Harare",
            Offence_status="UNCONVICTED", date_charged=SENTENCED, has_bail=True, bail_amount=100,
        )
        offences = {o["id"]: o for o in ComprehensiveInmateSerializer(self.inmate).data["offences"]}
        self.assertTrue(offences[self.offence.id]["has_fine"])
        self.assertEqual(float(offences[self.offence.id]["fine_amount"]), 50.0)
        self.assertTrue(offences[remand.id]["has_bail"])
        self.assertEqual(float(offences[remand.id]["bail_amount"]), 100.0)
