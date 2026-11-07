"""/auth/me/ returns the account's email and full name for the sidebar and header."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class CurrentUserIdentityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def me(self, user):
        self.client.force_authenticate(user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_email_and_full_name_are_returned(self):
        user = User.objects.create_superuser(
            "9000001A", email="t.nyathi@zps.gov.zw", password="unused-test-pass",
            first_name="Tendai", last_name="Nyathi",
        )
        data = self.me(user)
        self.assertEqual(data["email"], "t.nyathi@zps.gov.zw")
        self.assertEqual(data["full_name"], "Tendai Nyathi")

    def test_missing_email_is_null_not_blank(self):
        user = User.objects.create_superuser("9000002B", email="", password="unused-test-pass")
        data = self.me(user)
        self.assertIsNone(data["email"])
        self.assertIsNone(data["full_name"])
