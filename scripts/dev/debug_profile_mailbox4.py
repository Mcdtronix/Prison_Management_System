import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Auth.models import UserProfile, Department
from Auth.utils import normalize_role_code

profiles = UserProfile.objects.all()[:2]
for p in profiles:
    mapped = normalize_role_code(p.role.code)
    print(f"Role {p.role.code} -> mapped {mapped}")
