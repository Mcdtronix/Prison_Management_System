from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CatalogueView, ExportReportView, ReportTemplateViewSet, RunReportView

router = DefaultRouter()
router.register(r"templates", ReportTemplateViewSet, basename="report-template")

urlpatterns = [
    path("catalogue/", CatalogueView.as_view(), name="report-catalogue"),
    path("run/", RunReportView.as_view(), name="report-run"),
    path("export/", ExportReportView.as_view(), name="report-export"),
    path("", include(router.urls)),
]
