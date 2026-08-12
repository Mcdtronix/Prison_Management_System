import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Auth.models import OrgUnitDepartment
from django.contrib.auth.models import User
from Auth.utils import get_primary_assignment

print("Mailboxes:")
for mb in OrgUnitDepartment.objects.all()[:5]:
    print(f"Station: {mb.org_unit.code}, Dept: {mb.department.code}, Mailbox: {mb.mailbox_address}")

print("\nUsers:")
for user in User.objects.all():
    assignment = get_primary_assignment(user)
    if assignment:
        org_unit = assignment.org_unit
        dept = assignment.department
        if org_unit and dept:
            try:
                oud = OrgUnitDepartment.objects.get(org_unit=org_unit, department=dept)
                mb = oud.mailbox_address
            except:
                mb = "None"
        else:
            mb = "None"
        print(f"User: {user.username}, Role: {assignment.role.code}, Mailbox: {mb}")
    else:
        try:
            prof = user.userprofile
            print(f"User: {user.username}, Legacy Profile, Role: {prof.role.code}, Mailbox: None")
        except:
            print(f"User: {user.username}, No Profile (Superadmin?)")
