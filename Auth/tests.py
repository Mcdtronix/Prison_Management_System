from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Auth.models import Role, Station, UserProfile
from Auth.serializers import CustomTokenObtainPairSerializer
from HumanResources.models import Officer, OfficerStationHistory


class UserCreationApiTests(APITestCase):
    def setUp(self):
        self.station = Station.objects.create(
            code="HARARE",
            name="Harare Remand Prison",
            location="Harare",
        )
        self.other_station = Station.objects.create(
            code="BULAWAYO",
            name="Bulawayo Prison",
            location="Bulawayo",
        )

        self.admin_role = Role.objects.create(code="ADMIN_OFFICER", name="Admin Officer")
        self.super_role = Role.objects.create(code="SUPER_ADMIN", name="Super Administrator")
        self.reception_role = Role.objects.create(code="RECEPTION_OFFICER", name="Reception Officer")

        self.admin_user = User.objects.create_user(
            username="1234567A",
            password="StrongPass123!",
            first_name="Admin",
            last_name="Officer",
        )
        UserProfile.objects.create(
            user=self.admin_user,
            role=self.admin_role,
            station=self.station,
            is_active=True,
        )

        self.officer = Officer.objects.create(
            service_number="7654321B",
            first_name="Jane",
            surname="Doe",
            national_id="12-3456789 A 12",
            gender="Female",
            date_of_birth="1990-01-01",
            date_of_attestation="2015-01-01",
            current_status="ACTIVE",
        )
        OfficerStationHistory.objects.create(
            officer=self.officer,
            station=self.station,
            date_posted="2020-01-01",
            posted_by="HQ",
        )

        self.other_station_officer = Officer.objects.create(
            service_number="7654321C",
            first_name="John",
            surname="Smith",
            national_id="12-3456790 A 12",
            gender="Male",
            date_of_birth="1991-01-01",
            date_of_attestation="2016-01-01",
            current_status="ACTIVE",
        )
        OfficerStationHistory.objects.create(
            officer=self.other_station_officer,
            station=self.other_station,
            date_posted="2021-01-01",
            posted_by="HQ",
        )

        self.users_url = reverse("auth:user_list_create")
        self.options_url = reverse("auth:user_create_options")

    def authenticate(self):
        self.client.force_authenticate(user=self.admin_user)

    def test_admin_can_create_user_from_existing_officer(self):
        self.authenticate()

        response = self.client.post(
            self.users_url,
            {
                "officer": self.officer.service_number,
                "role": self.reception_role.id,
                "password": "SecurePass123!",
                "email": "jane.doe@prison.gov",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username=self.officer.service_number)
        profile = created_user.userprofile

        self.assertEqual(profile.officer, self.officer)
        self.assertEqual(profile.station, self.station)
        self.assertEqual(profile.role, self.reception_role)
        self.assertEqual(created_user.first_name, self.officer.first_name)
        self.assertEqual(created_user.last_name, self.officer.surname)

    def test_admin_cannot_create_user_for_officer_from_other_station(self):
        self.authenticate()

        response = self.client.post(
            self.users_url,
            {
                "officer": self.other_station_officer.service_number,
                "role": self.reception_role.id,
                "password": "SecurePass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("officer", response.data)

    def test_create_options_only_returns_eligible_officers_for_admin_station(self):
        self.authenticate()

        response = self.client.get(self.options_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        officer_ids = {item["service_number"] for item in response.data["officers"]}

        self.assertIn(self.officer.service_number, officer_ids)
        self.assertNotIn(self.other_station_officer.service_number, officer_ids)
        self.assertEqual(
            [role["code"] for role in response.data["roles"]],
            ["ADMIN_OFFICER", "RECEPTION_OFFICER"],
        )


class LoginCompatibilityTests(APITestCase):
    def setUp(self):
        self.station = Station.objects.create(
            code="CHV",
            name="Chivhu",
            location="Chivhu",
        )
        self.role = Role.objects.create(code="R.O", name="Reception")

        self.officer = Officer.objects.create(
            service_number="2934834Z",
            first_name="Macdonald",
            surname="Gudo",
            national_id="12-3456789 A 12",
            gender="Male",
            date_of_birth="1990-01-01",
            date_of_attestation="2015-01-01",
            current_status="ACTIVE",
        )
        OfficerStationHistory.objects.create(
            officer=self.officer,
            station=self.station,
            date_posted="2020-01-01",
            posted_by="HQ",
        )

        self.user = User.objects.create_user(
            username="macdonald",
            password="Password123!",
            first_name="Macdonald",
            last_name="Gudo",
        )
        UserProfile.objects.create(
            user=self.user,
            officer=self.officer,
            role=self.role,
            station=self.station,
            is_active=True,
        )

        self.login_url = reverse("auth:token_obtain_pair")

    def test_login_allows_service_number_for_linked_legacy_account(self):
        response = self.client.post(
            self.login_url,
            {
                "username": self.officer.service_number,
                "password": "Password123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["username"], self.user.username)
        self.assertEqual(response.data["role"], self.role.code)
        self.assertEqual(response.data["station_code"], self.station.code)

    def test_serializer_normalizes_service_number_case(self):
        serializer = CustomTokenObtainPairSerializer(
            data={"username": "2934834z", "password": "Password123!"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
