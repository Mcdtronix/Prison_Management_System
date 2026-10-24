import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Prison_Management_System.settings")
django.setup()

from Reports.models import ReportTemplate
from Reports.views import GenerateReportAPIView
from django.test import RequestFactory

template = ReportTemplate.objects.first()
if not template:
    print("No templates found")
else:
    factory = RequestFactory()
    request = factory.post('/api/reports/generate/', {'template_id': template.id}, format='json')
    request.user = template.created_by
    # Mock org_context
    request.org_context = None
    
    view = GenerateReportAPIView.as_view()
    response = view(request)
    print("STATUS:", response.status_code)
    print("DATA:", response.data)
