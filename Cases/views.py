from rest_framework import viewsets
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated
from .permissions import CasesRBACPermission

from .models import CaseFile, IncidentReport, CourtDate
from .serializers import CaseFileSerializer, IncidentReportSerializer, CourtDateSerializer


class CaseFileViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CaseFile.objects.all()
    serializer_class = CaseFileSerializer
    permission_classes = (IsAuthenticated, CasesRBACPermission)

    def perform_create(self, serializer):
        owner = getattr(self.request, 'org_unit', None)
        serializer.save(created_by=self.request.user, owner_org_unit=owner)


class IncidentReportViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = IncidentReport.objects.select_related('case').all()
    serializer_class = IncidentReportSerializer
    permission_classes = (IsAuthenticated, CasesRBACPermission)

    def perform_create(self, serializer):
        owner = getattr(self.request, 'org_unit', None)
        serializer.save(reported_by=self.request.user, owner_org_unit=owner)


class CourtDateViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CourtDate.objects.select_related('case').all()
    serializer_class = CourtDateSerializer
    permission_classes = (IsAuthenticated, CasesRBACPermission)

    def perform_create(self, serializer):
        owner = getattr(self.request, 'org_unit', None)
        serializer.save(owner_org_unit=owner)
