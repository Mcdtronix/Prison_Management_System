import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from django.test import RequestFactory
from Core.middleware.org_context import OrgContextMiddleware
from Core.middleware.mailbox_context import MailboxContextMiddleware
from Messaging.views import ThreadViewSet
from django.db.models import Q
from Messaging.models import Thread

admin_user = User.objects.get(username='admin')
print(f"Testing for user: {admin_user.username} (superuser: {admin_user.is_superuser})")

rf = RequestFactory()
request = rf.get('/api/messaging/threads/?folder=inbox')
request.user = admin_user

org_mw = OrgContextMiddleware(lambda r: None)
org_mw.process_request(request)
print(f"After OrgContext: org_unit={request.org_unit}, department={request.department}")

mb_mw = MailboxContextMiddleware(lambda r: None)
mb_mw.process_request(request)
print(f"After MailboxContext: org_unit={request.org_unit}, department={request.department}, mailbox={request.mailbox}")

if request.mailbox:
    qs = ThreadViewSet.queryset.all()
    qs = qs.filter(participants__mailbox=request.mailbox)
    qs = qs.filter(~Q(messages__sender=request.mailbox)).distinct()
    print(f"Inbox Threads for {request.mailbox.mailbox_address}: {[t.id for t in qs]}")
else:
    print("NO MAILBOX SET!")
