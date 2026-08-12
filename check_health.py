import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
for u in User.objects.all():
    try:
        print(f"User: {u.username}, Role code: {u.userprofile.role.code}")
    except:
        pass
