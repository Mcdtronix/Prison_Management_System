import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Auth.models import UserProfile, OrgUnit, Department
from Auth.serializers import UserProfileSerializer

profiles = UserProfile.objects.all()[:2]
for p in profiles:
    print(f"User: {p.user.username}, Role: {p.role.code}, Station: {p.station.code if p.station else None}")
    
    # Try to find mailbox
    from Messaging.models import Mailbox
    try:
        # Station is an OrgUnit? No, Station is legacy? Let's check if there is an OrgUnit with the same code
        ou = OrgUnit.objects.get(code=p.station.code) if p.station else None
        dept = Department.objects.get(code=p.role.code)
        
        from Auth.models import OrgUnitDepartment
        oud = OrgUnitDepartment.objects.get(org_unit=ou, department=dept)
        print(f"Mailbox: {oud.mailbox_address}")
    except Exception as e:
        print("Error finding mailbox:", e)

