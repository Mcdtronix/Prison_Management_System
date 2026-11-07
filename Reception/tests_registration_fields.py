"""Father's name, trousers and multi-currency cash on basic inmate registration."""
from decimal import Decimal

from django.test import TestCase

from Auth.models import Station
from Reception.models import InmatePropertyHistory
from Reception.serializers import (
    BasicInmateRegistrationSerializer,
    ComprehensiveInmateSerializer,
)


def payload(**details):
    return {
        "inmateDetails": {
            "admission_type": "NEW_ADMISSION",
            "prison_number": "0101/26",
            "first_name": "Tendai",
            "surname": "Moyo",
            "gender": "Male",
            "date_of_birth": "1990-01-15",
            "nationality": "Zimbabwean",
            "address": "12 Main Street, Chivhu",
            "marital_status": "Single",
            "educational_level": "Ordinary Level",
            "headman": "Mutasa",
            "chief": "Nyashanu",
            "district": "Chikomba",
            "is_first_time_offender": True,
            **details,
        },
        "nextOfKin": {},
        "inmateValuables": {
            "bagNo": "B-17",
            "trousers": "yes",
            "trousersColor": "Blue",
            "socks": "yes",
        },
    }


class RegistrationFieldsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Station.objects.create(name="Chivhu", code="CHV")

    def register(self, **details):
        serializer = BasicInmateRegistrationSerializer(data=payload(**details))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_fathers_name_is_saved_and_shown_on_details(self):
        inmate = self.register(fathers_name="Joseph Moyo")
        inmate.refresh_from_db()
        self.assertEqual(inmate.fathers_name, "Joseph Moyo")

        data = ComprehensiveInmateSerializer(inmate).data
        self.assertEqual(data["fathers_name"], "Joseph Moyo")
        # The rest of the local home history now reaches the details page too.
        self.assertEqual(data["chief"], "Nyashanu")
        self.assertEqual(data["district"], "Chikomba")
        self.assertEqual(data["address"], "12 Main Street, Chivhu")

    def test_fathers_name_is_optional(self):
        inmate = self.register()
        self.assertFalse(inmate.fathers_name)

    def test_trousers_are_logged_with_their_colour(self):
        inmate = self.register()
        items = InmatePropertyHistory.objects.get(inmate=inmate).items_description
        self.assertIn("Trousers (Blue)", items)
        self.assertIn("Socks", items)


class CashHoldingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Station.objects.create(name="Chivhu", code="CHV")

    def register(self, **valuables):
        data = payload()
        data["inmateValuables"] = {"bagNo": "B-20", **valuables}
        serializer = BasicInmateRegistrationSerializer(data=data)
        return serializer, (serializer.save() if serializer.is_valid() else None)

    def test_each_currency_is_stored_in_its_own_currency(self):
        serializer, inmate = self.register(cashHoldings=[
            {"currency": "USD", "amount": "10"},
            {"currency": "ZWG", "amount": "500"},
            {"currency": "ZAR", "amount": "4000.50"},
        ])
        self.assertIsNotNone(inmate, serializer.errors)
        record = InmatePropertyHistory.objects.get(inmate=inmate)
        held = {h.currency: h.amount for h in record.cash_holdings.all()}
        self.assertEqual(held, {"USD": Decimal("10"), "ZWG": Decimal("500"), "ZAR": Decimal("4000.50")})
        # The legacy column mirrors the USD figure only; nothing is converted.
        self.assertEqual(record.cash_amount, Decimal("10"))

        shown = ComprehensiveInmateSerializer(inmate).data["valuables"]["cash_holdings"]
        self.assertEqual(
            [(h["currency"], h["amount"]) for h in shown],
            [("USD", "10.00"), ("ZAR", "4000.50"), ("ZWG", "500.00")],
        )

    def test_duplicate_currency_is_rejected(self):
        serializer, inmate = self.register(cashHoldings=[
            {"currency": "USD", "amount": "10"},
            {"currency": "USD", "amount": "5"},
        ])
        self.assertIsNone(inmate)
        self.assertIn("cashHoldings", serializer.errors["inmateValuables"])

    def test_unknown_currency_and_zero_amount_are_rejected(self):
        serializer, inmate = self.register(cashHoldings=[{"currency": "XYZ", "amount": "10"}])
        self.assertIsNone(inmate)
        serializer, inmate = self.register(cashHoldings=[{"currency": "USD", "amount": "0"}])
        self.assertIsNone(inmate)

    def test_legacy_single_cash_value_is_stored_as_usd(self):
        serializer, inmate = self.register(cash="25.00")
        self.assertIsNotNone(inmate, serializer.errors)
        record = InmatePropertyHistory.objects.get(inmate=inmate)
        self.assertEqual(
            [(h.currency, h.amount) for h in record.cash_holdings.all()], [("USD", Decimal("25.00"))]
        )

    def test_cash_alone_creates_a_property_record(self):
        data = payload()
        data["inmateValuables"] = {"cashHoldings": [{"currency": "BWP", "amount": "200"}]}
        serializer = BasicInmateRegistrationSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        inmate = serializer.save()
        self.assertTrue(InmatePropertyHistory.objects.filter(inmate=inmate).exists())


class ConsoleAccountStationTests(TestCase):
    """Accounts created in the admin console have an org unit but no legacy station."""

    def setUp(self):
        from types import SimpleNamespace
        from django.contrib.auth.models import User
        from Auth.models import OrgUnit

        nat = OrgUnit.objects.create(code="NAT", name="National", code_short="NAT", unit_type="NATIONAL_HQ")
        prov = OrgUnit.objects.create(
            code="MSV", name="Masvingo Province", code_short="MSV", unit_type="PROVINCIAL_HQ", parent=nat
        )
        self.unit = OrgUnit.objects.create(
            code="CHIVHU", name="Chivhu Prison", code_short="CHV", unit_type="STATION", parent=prov
        )
        self.user = User.objects.create_user("1234567E", password="unused-test-pass")
        self.request = SimpleNamespace(user=self.user, org_unit=self.unit)

    def save(self):
        serializer = BasicInmateRegistrationSerializer(data=payload(), context={"request": self.request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_station_is_resolved_from_the_org_unit(self):
        station = Station.objects.create(name="Chivhu Prison", code="Chivhu")
        inmate = self.save()
        self.assertEqual(inmate.station_history.get().station, station)
        self.assertEqual(inmate.owner_org_unit, self.unit)

    def test_missing_station_gives_a_clear_error_and_saves_nothing(self):
        from rest_framework.exceptions import ValidationError
        from Reception.models import Inmate

        with self.assertRaisesMessage(ValidationError, "not linked to a station"):
            self.save()
        self.assertFalse(Inmate.objects.exists())
