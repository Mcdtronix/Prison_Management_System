import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Auth.models import UserProfile, OrgUnit, Department
from Auth.utils import normalize_role_code

profiles = UserProfile.objects.all()[:2]
for p in profiles:
    ou = OrgUnit.objects.filter(name=p.station.name).first() if p.station else None
    mapped_role = normalize_role_code(p.role.code)
    dept = Department.objects.filter(code=mapped_role).first()
    
    if ou and dept:
        from Auth.models import OrgUnitDepartment
        oud = OrgUnitDepartment.objects.filter(org_unit=ou, department=dept).first()
        if oud:
            print(f"User: {p.user.username} -> Mailbox: {oud.mailbox_address}")
        else:
            print(f"User: {p.user.username} -> OUD not found for {ou.code} {dept.code}")
    else:
        print(f"User: {p.user.username} -> OrgUnit or Dept not found")

