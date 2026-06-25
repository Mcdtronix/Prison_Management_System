import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Mcdtronix.settings")
django.setup()
from django.test import Client
from Auth.models import User
c = Client()
u = User.objects.first()
c.force_login(u)
res = c.get('/api/hr/officers/')
print("Status:", res.status_code)
if res.status_code == 200:
    data = res.json()
    if isinstance(data, dict):
        print("Keys:", data.keys())
    else:
        print("List length:", len(data))
