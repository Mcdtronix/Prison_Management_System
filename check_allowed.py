import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from django.test import RequestFactory
from Core.middleware.org_context import OrgContextMiddleware
from Core.middleware.mailbox_context import MailboxContextMiddleware

rf = RequestFactory()
request = rf.get('/')
user = User.objects.get(username='2934800B') # Reception user
request.user = user

org_mw = OrgContextMiddleware(lambda r: None)
org_mw.process_request(request)
mb_mw = MailboxContextMiddleware(lambda r: None)
mb_mw.process_request(request)

print(request.message_recipients.keys())
