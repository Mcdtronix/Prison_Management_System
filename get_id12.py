import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import OrgUnitDepartment
try:
    oud = OrgUnitDepartment.objects.get(id=12)
    print("Address:", oud.mailbox_address)
except Exception as e:
    print(e)
