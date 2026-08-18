import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Reports.models import ReportTemplate
from rest_framework.test import APIRequestFactory
from Reports.views import GenerateReportAPIView
from Auth.models import CustomUser

template = ReportTemplate.objects.filter(base_model='Inmate').first()
print("Template:", template.name, "Fields:", template.selected_fields)

factory = APIRequestFactory()
request = factory.post('/api/reports/generate/', {'template_id': template.id})
request.user = CustomUser.objects.first()
from Core.middleware.org_context import get_org_context
request.org_context = getattr(request.user, 'station', None)

view = GenerateReportAPIView.as_view()
response = view(request)
if response.status_code == 200:
    for row in response.data['data'][:2]:
        print(row)
else:
    print(response.data)

