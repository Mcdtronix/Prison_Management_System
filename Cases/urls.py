from rest_framework import routers
from django.urls import path, include

from .views import CaseFileViewSet, IncidentReportViewSet, CourtDateViewSet

router = routers.DefaultRouter()
router.register(r'casefiles', CaseFileViewSet)
router.register(r'incidents', IncidentReportViewSet)
router.register(r'courtdates', CourtDateViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
