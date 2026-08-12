import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Messaging.models import Message
for msg in Message.objects.all():
    if msg.sender and not msg.read_by.filter(id=msg.sender.id).exists():
        msg.read_by.add(msg.sender)
        print(f"Fixed msg {msg.id}")
