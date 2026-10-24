import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Reception.models import Convicted

c = Convicted.objects.filter(prison_number__prison_number='0005/26').first()
if c:
    print(c.__dict__)

