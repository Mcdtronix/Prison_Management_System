import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Messaging.models import Mailbox, ThreadParticipant, Message
mb = Mailbox.objects.get(mailbox_address='administration@nat-hq.pms.local')
participants = ThreadParticipant.objects.filter(mailbox=mb)
print(f"Mailbox: {mb.mailbox_address}")
print(f"Participants count: {participants.count()}")
count = 0
for p in participants:
    unread = p.thread.messages.exclude(read_by=mb).count()
    print(f"Thread {p.thread.id}: {unread} unread")
    count += unread
print(f"Total unread: {count}")
