import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from django.test import RequestFactory
from rest_framework.test import force_authenticate
from Messaging.views import ThreadViewSet
from Core.middleware.org_context import OrgContextMiddleware
from Core.middleware.mailbox_context import MailboxContextMiddleware

rf = RequestFactory()
request = rf.post('/api/messaging/threads/', {'subject': 'Test', 'participants': 'health@chv_stn.pms.local'}, content_type='application/json')
user = User.objects.get(username='2934800B') # Reception user
request.user = user
force_authenticate(request, user=user)

org_mw = OrgContextMiddleware(lambda r: None)
org_mw.process_request(request)
mb_mw = MailboxContextMiddleware(lambda r: None)
mb_mw.process_request(request)

try:
    view = ThreadViewSet.as_view({'post': 'create'})
    response = view(request)
    print("Response status:", response.status_code)
    print("Response data:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()
