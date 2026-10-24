import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
from Auth.models import UserAssignment
User = get_user_model()
for u in User.objects.all():
    a = UserAssignment.objects.filter(user=u, is_active=True).first()
    if a:
        print(f"User: {u.username}, Role: {a.role.name}, Org: {a.org_unit.name if a.org_unit else 'None'}, Dept: {a.department.name if a.department else 'None'}, Mailbox: {a.department.code.lower()}@{a.org_unit.code.lower() if a.org_unit else 'nat-hq'}.pms.local")
    else:
        print(f"User: {u.username}, No Active Assignment")
