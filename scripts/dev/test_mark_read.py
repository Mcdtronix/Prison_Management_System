import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Messaging.models import Thread, Mailbox, Message, ThreadParticipant
from django.test import RequestFactory
from Messaging.views import ThreadViewSet
from Auth.models import User

mb = Mailbox.objects.get(mailbox_address='administration@nat-hq.pms.local')
user = User.objects.filter(role='SUPER_ADMIN').first()
factory = RequestFactory()
request = factory.post(f'/api/messaging/threads/1/mark_read/')
request.user = user
request.mailbox = mb

view = ThreadViewSet.as_view({'post': 'mark_read'})
response = view(request, pk=1)
print("Response status:", response.status_code)
print("Response data:", response.data)
