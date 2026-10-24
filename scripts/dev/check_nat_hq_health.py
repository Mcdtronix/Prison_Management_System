import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import UserAssignment
from django.contrib.auth import get_user_model
User = get_user_model()
assignments = UserAssignment.objects.filter(org_unit__unit_type='NATIONAL_HQ', department__code='HEALTH')
if assignments.exists():
    for a in assignments:
        print(f"User: {a.user.username} at National HQ Health")
else:
    print("No users assigned to National HQ Health")
