from django.db import models
from django.contrib.auth import get_user_model


class CaseFile(models.Model):
    """High-level case file tying incidents, hearings and attachments."""
    reference = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner_org_unit = models.ForeignKey('Auth.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='casefiles')
    created_by = models.ForeignKey(get_user_model(), null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reference} - {self.title}"


class IncidentReport(models.Model):
    LEVEL_CHOICES = (('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'))

    case = models.ForeignKey(CaseFile, related_name='incidents', on_delete=models.CASCADE)
    occurred_at = models.DateTimeField()
    reported_by = models.ForeignKey(get_user_model(), null=True, blank=True, on_delete=models.SET_NULL)
    summary = models.TextField()
    details = models.TextField(blank=True)
    severity = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='LOW')
    owner_org_unit = models.ForeignKey('Auth.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='incident_reports')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']

    def __str__(self):
        return f"Incident {self.id} ({self.severity})"


class CourtDate(models.Model):
    case = models.ForeignKey(CaseFile, related_name='court_dates', on_delete=models.CASCADE)
    scheduled_for = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    owner_org_unit = models.ForeignKey('Auth.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='court_dates')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scheduled_for']

    def __str__(self):
        return f"Court on {self.scheduled_for.date()} for {self.case.reference}"
