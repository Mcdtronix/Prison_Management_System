import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import OrgUnitDepartment, OrgUnit, Department
stn = OrgUnit.objects.get(code='CHV_STN')
dept = Department.objects.get(code='RECEPTION')
try:
    oud = OrgUnitDepartment.objects.get(org_unit=stn, department=dept)
    print(f"Mailbox: {oud.mailbox_address}")
except Exception as e:
    print(f"Error: {e}")
