import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Messaging.models import Thread, Mailbox, Message, ThreadParticipant
qs = Thread.objects.all().order_by('-id')[:2]
for t in qs:
    print(f"Thread ID: {t.id} - Subject: {t.subject}")
    print(f"  Participants: {[p.mailbox.mailbox_address for p in t.participants.all()]}")
    for m in t.messages.all():
        print(f"  Message from {m.sender.mailbox_address if m.sender else 'None'}")
print("Mailboxes:")
for mb in Mailbox.objects.all():
    print(f" - {mb.mailbox_address}")
