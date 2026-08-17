import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from Reports.views import GenerateReportAPIView
from Reports.models import ReportTemplate

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()

template = ReportTemplate.objects.first()
if not template:
    template = ReportTemplate.objects.create(name="Test Template", base_model="Inmate", selected_fields=["first_name"], filters={"operator": "AND", "conditions": []}, created_by=user)

factory = RequestFactory()
request = factory.post('/api/reports/generate/', {'template_id': template.id, 'export_format': 'csv'}, content_type='application/json')
request.user = user

view = GenerateReportAPIView.as_view()
response = view(request)

print(response.status_code)
print(response.headers.get('Content-Type'))
print(response.content[:100])
