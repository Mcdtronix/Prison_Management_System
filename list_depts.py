import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import Department
for d in Department.objects.all():
    print(d.code)
