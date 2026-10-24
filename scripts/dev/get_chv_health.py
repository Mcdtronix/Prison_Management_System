import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import OrgUnitDepartment
oud = OrgUnitDepartment.objects.filter(org_unit__code='CHV_STN', department__code='HEALTH').first()
if oud:
    print("Address:", oud.mailbox_address)
else:
    print("No OUD for CHV_STN HEALTH")
