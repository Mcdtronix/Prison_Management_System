from Reception.serializers import OffenceRegistrationSerializer
from rest_framework.request import Request
from django.test.client import RequestFactory
from Auth.models import User

user = User.objects.first()
factory = RequestFactory()
request = factory.post('/api/reception/register-offences/')
request.user = user

data = {
    "inmate_id": 1,
    "offences": [
        {
            "offence": "Theft",
            "court": "High Court",
            "convictionStatus": "convicted",
            "sentence": "5 years",
            "sentenceDate": "2026-01-01"
        }
    ]
}

serializer = OffenceRegistrationSerializer(data=data, context={'request': Request(request)})
print("Is valid:", serializer.is_valid())
if not serializer.is_valid():
    print(serializer.errors)
else:
    try:
        serializer.save()
        print("Success")
    except Exception as e:
        import traceback
        traceback.print_exc()

