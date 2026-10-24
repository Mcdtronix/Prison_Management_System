import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth.models import User
from Auth.utils import get_primary_assignment
user = User.objects.get(username='2934800B')
assignment = get_primary_assignment(user)
print(f"Org: {assignment.org_unit.code if assignment.org_unit else 'None'}, Dept: {assignment.department.code if assignment.department else 'None'}")
