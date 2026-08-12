import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Auth.models import UserProfile, OrgUnit, Department
from Auth.serializers import UserProfileSerializer

profiles = UserProfile.objects.all()[:2]
for p in profiles:
    # Station is legacy. Let's find OrgUnit with name=p.station.name
    ou = OrgUnit.objects.filter(name=p.station.name).first() if p.station else None
    
    # Try to map role.code ('R.O' -> 'RECEPTION')
    role_code_mapping = {
        'R.O': 'RECEPTION',
        'H.O': 'HEALTH',
        'S.O': 'SECURITY'
    }
    mapped_role = role_code_mapping.get(p.role.code, p.role.code)
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

