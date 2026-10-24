import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Messaging.serializers import ThreadSerializer
from Messaging.models import Thread
qs = Thread.objects.all()[:1]
for t in qs:
    print(ThreadSerializer(t).data)
