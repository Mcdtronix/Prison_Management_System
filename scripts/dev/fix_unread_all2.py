import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Messaging.models import Thread, Mailbox, ThreadParticipant
for mb in Mailbox.objects.all():
    for p in ThreadParticipant.objects.filter(mailbox=mb):
        for m in p.thread.messages.exclude(read_by=mb):
            m.read_by.add(mb)

    count = 0
    for p in ThreadParticipant.objects.filter(mailbox=mb):
        unread = p.thread.messages.exclude(read_by=mb).count()
        count += unread

    if count > 0:
        print(f"Unread count after fix for {mb.mailbox_address}:", count)
print("Done fixing all mailboxes.")
