from django.test import TestCase
from datetime import date
from Reception.models import Inmate, Offence, Convicted, Restitution, ReleaseHistory

class SentenceRemissionTest(TestCase):
    def setUp(self):
        # Create an inmate
        self.inmate = Inmate.objects.create(
            first_name="Test",
            surname="Inmate",
            prison_number="TST123",
            admission_type="Convict",
            admission_date=date(2023, 8, 30),
            date_of_birth=date(1990, 1, 1),
            gender="Male",
            nationality="Zimbabwean"
        )
        # Create an offence
        self.offence = Offence.objects.create(
            inmate=self.inmate,
            offence_description="Theft",
            court="Magistrate",
            Offence_status="CONVICTED",
            date_charged=date(2023, 8, 30)
        )

    def test_restitution_unpaid(self):
        # 36 months sentence => 36 * 30 = 1080 days
        conviction = Convicted.objects.create(
            prison_number=self.inmate,
            offence=self.offence,
            date_of_sentence=date(2023, 8, 30),
            sentence_years=0,
            sentence_months=36,
            sentence_days=0
        )
        
        # Restitution: subtract 12 months (360 days) if $200 is paid on/before 2026-08-30
        restitution = Restitution.objects.create(
            inmate=self.inmate,
            offence=self.offence,
            restitution_amount=200,
            restitution_date=date(2026, 8, 30),
            restitution_sentence_years=0,
            restitution_sentence_months=12,
            restitution_sentence_days=0,
            status='pending'  # unpaid
        )

        # Re-fetch ReleaseHistory since it was created via signals
        history = ReleaseHistory.objects.get(inmate=self.inmate)
        
        # Expected:
        # standard sentence = 1080 days.
        # restitution paid sentence = 1080 - 360 = 720 days.
        # active should be standard since restitution is pending
        self.assertEqual(history.total_sentences_days, 1080)
        self.assertEqual(history.total_remission_days, 360) # 1/3 of 1080

        # EDR should be 1080 - 360 = 720 days from sentence date. ODR = 1080 days.
        # Let's verify active dates match standard dates
        self.assertEqual(history.active_edr, history.edr_standard)
        self.assertEqual(history.active_odr, history.odr_standard)

    def test_restitution_paid(self):
        # 36 months sentence => 1080 days
        conviction = Convicted.objects.create(
            prison_number=self.inmate,
            offence=self.offence,
            date_of_sentence=date(2023, 8, 30),
            sentence_years=0,
            sentence_months=36,
            sentence_days=0
        )
        
        # Restitution: subtract 12 months (360 days) if $200 is paid on/before 2023-09-30 (PAST DATE)
        restitution = Restitution.objects.create(
            inmate=self.inmate,
            offence=self.offence,
            restitution_amount=200,
            restitution_date=date(2023, 9, 30),
            restitution_sentence_years=0,
            restitution_sentence_months=12,
            restitution_sentence_days=0,
            status='paid',
            receipt='dummy.pdf'  # required for the paid logic in the model to trigger active paid dates
        )

        history = ReleaseHistory.objects.get(inmate=self.inmate)
        
        # Expected:
        # active should be restitution paid since it is paid and has receipt
        # effective sentence = 24 months = 720 days
        # remission = 1/3 of 720 = 240 days
        self.assertEqual(history.total_sentences_days, 720)
        self.assertEqual(history.total_remission_days, 240)
        
        self.assertEqual(history.active_edr, history.edr_restitution_paid)
        self.assertEqual(history.active_odr, history.odr_restitution_paid)
