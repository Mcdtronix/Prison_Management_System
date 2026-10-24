import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from Auth.views import current_user_view
from django.test import RequestFactory
from rest_framework.test import force_authenticate

rf = RequestFactory()
request = rf.get('/api/auth/me/')
admin_user = User.objects.get(username='admin')
force_authenticate(request, user=admin_user)
response = current_user_view(request)
print("Admin Response:", response.data)

try:
    health_user = User.objects.get(username='2934801C')
    request2 = rf.get('/api/auth/me/')
    force_authenticate(request2, user=health_user)
    response2 = current_user_view(request2)
    print("Health Response:", response2.data)
except Exception as e:
    print(e)
