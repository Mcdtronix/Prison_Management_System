import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Messaging.models import ThreadParticipant, Message, Mailbox

for mb in Mailbox.objects.all():
    participants = ThreadParticipant.objects.filter(mailbox=mb)
    count = 0
    unread_msgs = []
    for p in participants:
        unread = p.thread.messages.exclude(read_by=mb)
        for msg in unread:
            unread_msgs.append((msg.id, msg.thread.id, msg.body))
        count += unread.count()
    if count > 0:
        print(f"Mailbox {mb.mailbox_address} has {count} unread msgs: {unread_msgs}")
