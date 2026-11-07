"""
Report Builder API.

GET  catalogue/          sources the user's role may report on, with their columns
POST run/                paged preview of a report
POST export/             CSV / Excel / PDF of a report (audited)
     templates/          the user's saved reports (and those shared within their role)

Every endpoint re-checks access on the server: the catalogue, a run, an export
and a saved template all go through Reports.engine, which refuses a source the
user's role cannot use and scopes rows to the user's station.
"""
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from Auth.utils import get_current_role_code, log_action

from .catalogue import SOURCES, can_use, describe, sources_for
from .engine import PREVIEW_MAX_PAGE_SIZE, ReportError, prepare, rows
from .exporters import EXPORTERS
from .models import ReportTemplate
from .serializers import ReportTemplateSerializer


def _error(exc: ReportError):
    return Response({"error": str(exc)}, status=exc.status)


def _scope_label(request):
    unit = getattr(request, "org_unit", None)
    if unit is not None:
        return unit.name
    user = request.user
    try:
        station = user.userprofile.station
        return station.name if station else None
    except Exception:
        return None


class CatalogueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"sources": [describe(s) for s in sources_for(request.user)]})


class RunReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            report = prepare(request.user, request.data)
        except ReportError as exc:
            return _error(exc)

        try:
            page = max(int(request.data.get("page", 1)), 1)
            page_size = min(max(int(request.data.get("page_size", 50)), 1), PREVIEW_MAX_PAGE_SIZE)
        except (TypeError, ValueError):
            return Response({"error": "Invalid page."}, status=status.HTTP_400_BAD_REQUEST)

        total = report.queryset.count()
        data = list(rows(report, offset=(page - 1) * page_size, limit=page_size))
        return Response({
            "source": report.source.key,
            "columns": [{"key": c.key, "label": c.label, "type": c.type} for c in report.columns],
            "rows": data,
            "total": total,
            "page": page,
            "page_size": page_size,
            "sort": report.sort,
        })


class ExportReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        export_format = request.data.get("format")
        exporter = EXPORTERS.get(export_format)
        if exporter is None:
            return Response({"error": "Choose CSV, Excel or PDF."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            report = prepare(request.user, request.data)
        except ReportError as exc:
            return _error(exc)

        title = (request.data.get("title") or report.source.label).strip()[:120]
        total = report.queryset.count()
        log_action(
            request,
            f"Exported report '{title}' ({report.source.label}) as {export_format.upper()}",
            "REPORTS",
            object_type="Report",
            remarks=f"Rows: {total}. Columns: {', '.join(report.labels())}",
        )
        return exporter(report, title, request.user, _scope_label(request), total)


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """
    Saved reports. A user sees their own and those saved by colleagues in the
    same role, but only for sources their role can use. Only the author may
    change or delete a saved report.
    """
    serializer_class = ReportTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        allowed = [s.key for s in sources_for(user)]
        role = get_current_role_code(user)
        same_role_authors = [
            t.created_by_id for t in ReportTemplate.objects.select_related("created_by")
            if get_current_role_code(t.created_by) == role
        ] if role else []
        return (
            ReportTemplate.objects.filter(base_model__in=allowed)
            .filter(Q(created_by=user) | Q(created_by_id__in=same_role_authors))
            .select_related("created_by")
        )

    def _check_author(self, instance):
        if instance.created_by_id != self.request.user.id:
            raise PermissionDenied("Only the officer who saved this report can change or delete it.")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        self._check_author(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_author(instance)
        instance.delete()
