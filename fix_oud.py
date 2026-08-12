import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import OrgUnitDepartment, OrgUnit, Department
from django.contrib.auth.models import User
from Auth.utils import get_primary_assignment

for user in User.objects.all():
    assignment = get_primary_assignment(user)
    if assignment and assignment.org_unit and assignment.department:
        oud, created = OrgUnitDepartment.objects.get_or_create(
            org_unit=assignment.org_unit,
            department=assignment.department
        )
        if created:
            print(f"Created Mailbox for {user.username}: {oud.mailbox_address}")
