from django.contrib import admin

from .models import CaseFile, IncidentReport, CourtDate


@admin.register(CaseFile)
class CaseFileAdmin(admin.ModelAdmin):
    list_display = ('reference', 'title', 'owner_org_unit', 'created_by', 'created_at')
    search_fields = ('reference', 'title')
    list_filter = ('owner_org_unit',)


@admin.register(IncidentReport)
class IncidentReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'case', 'severity', 'occurred_at', 'owner_org_unit')
    search_fields = ('summary', 'details')
    list_filter = ('severity', 'owner_org_unit')


@admin.register(CourtDate)
class CourtDateAdmin(admin.ModelAdmin):
    list_display = ('case', 'scheduled_for', 'location', 'owner_org_unit')
    list_filter = ('owner_org_unit',)
