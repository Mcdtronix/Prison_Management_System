from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportTemplateViewSet, AvailableFieldsAPIView, GenerateReportAPIView

router = DefaultRouter()
router.register(r'templates', ReportTemplateViewSet, basename='report-template')

urlpatterns = [
    path('available-fields/', AvailableFieldsAPIView.as_view(), name='available-fields'),
    path('generate/', GenerateReportAPIView.as_view(), name='generate-report'),
    path('', include(router.urls)),
]
