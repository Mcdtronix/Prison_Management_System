import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Core.settings")
django.setup()

from Reception.serializers import BasicInmateRegistrationSerializer
from Auth.models import User
from django.test import RequestFactory

data = {
    "inmateDetails": {
        "admission_type": "NEW_ADMISSION",
        "prison_number": "0018/26",
        "crb_number": "CHV 562/26",
        "first_name": "James",
        "surname": "Yeti",
        "other_names": "",
        "gender": "Male",
        "date_of_birth": "1990-01-01",
        "nationality": "Zimbabwean",
        "national_id": "",
        "address": "Plot 6, sadza",
        "marital_status": "Single",
        "educational_level": "Secondary",
        "race": "African",
        "headman": "",
        "chief": "",
        "district": "Harare",
        "occupation": "Farmer",
        "is_first_time_offender": True,
    },
    "nextOfKin": {
        "full_name": "Henry Yeti",
        "relationship": "Grandfather",
        "address": "Plot 6, sadza",
        "contact": "+263789653123"
    },
    "inmateValuables": {}
}

req = RequestFactory().post('/api/reception/register/', data, content_type='application/json')
req.user = User.objects.first()

serializer = BasicInmateRegistrationSerializer(data=data, context={'request': req})
if serializer.is_valid():
    try:
        serializer.save()
        print("Success")
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("Validation errors:", serializer.errors)
