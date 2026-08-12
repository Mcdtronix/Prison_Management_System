import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Messaging.models import Thread, Mailbox, Message
from django.db.models import Q

mb = Mailbox.objects.get(mailbox_address='administration@nat-hq.pms.local')
print("Total threads:", Thread.objects.filter(participants__mailbox=mb).count())

# Threads with at least one message not from mb
qs_has_other = Thread.objects.filter(participants__mailbox=mb).filter(~Q(messages__sender=mb)).distinct()
print("Has other sender:", qs_has_other.count())

# Exclude threads where ANY message is from mb
qs_no_mb = Thread.objects.filter(participants__mailbox=mb).exclude(messages__sender=mb)
print("Exclude ANY from mb:", qs_no_mb.count())
