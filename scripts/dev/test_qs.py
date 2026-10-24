import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Messaging.models import Thread, Mailbox, Message
mb = Mailbox.objects.get(mailbox_address='administration@nat-hq.pms.local')
print("Total threads for mb:", Thread.objects.filter(participants__mailbox=mb).count())

qs1 = Thread.objects.filter(participants__mailbox=mb).exclude(messages__sender=mb)
print("Exclude sender=mb:", qs1.count())

qs2 = Thread.objects.filter(participants__mailbox=mb).filter(~django.db.models.Q(messages__sender=mb)).distinct()
print("Filter ~Q:", qs2.count())
