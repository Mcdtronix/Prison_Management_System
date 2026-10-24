import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Messaging.models import Thread, Mailbox, Message, ThreadParticipant
from django.db.models import Q
mailbox = Mailbox.objects.get(mailbox_address='administration@nat-hq.pms.local')
qs = Thread.objects.all()
qs = qs.filter(participants__mailbox=mailbox)
qs = qs.filter(~Q(messages__sender=mailbox)).distinct()
print("Administration Inbox Threads:", [t.id for t in qs])

mailbox2 = Mailbox.objects.get(mailbox_address='health@nat-hq.pms.local')
qs2 = Thread.objects.all()
qs2 = qs2.filter(participants__mailbox=mailbox2)
qs2 = qs2.filter(~Q(messages__sender=mailbox2)).distinct()
print("Health Inbox Threads:", [t.id for t in qs2])

