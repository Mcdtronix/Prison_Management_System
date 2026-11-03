"""Read-only report: look for privilege escalation that happened before Phase 0.

Before the Phase 0 fix, any signed-in user could give themselves any role,
create or edit roles and departments, and approve data-exposure policies.
This command lists everything that could have been produced that way so a
person can check each item. It changes nothing.

    python manage.py security_escalation_report
    python manage.py security_escalation_report --since 2026-01-01
"""
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from Auth.rbac import TIER_OPERATIONAL, assignment_tier
from Auth.models import AuditLog, DataExposurePolicy, Department, Role, UserAssignment

User = get_user_model()


def _fmt(dt):
    return timezone.localtime(dt).strftime('%Y-%m-%d %H:%M') if dt else '-'


class Command(BaseCommand):
    help = 'List admin-level grants, roles, departments and policies that need a human check.'

    def add_arguments(self, parser):
        parser.add_argument('--since', help='Only show items created on or after this date (YYYY-MM-DD).')

    def handle(self, *args, **opts):
        since = None
        if opts.get('since'):
            since = timezone.make_aware(datetime.strptime(opts['since'], '%Y-%m-%d'))

        def recent(qs, field='created_at'):
            return qs.filter(**{f'{field}__gte': since}) if since else qs

        out = self.stdout.write
        flagged = 0

        out(self.style.MIGRATE_HEADING('1. Django superusers and staff'))
        for u in User.objects.filter(is_superuser=True) | User.objects.filter(is_staff=True):
            out(f'  {u.username:<20} superuser={u.is_superuser} staff={u.is_staff} '
                f'active={u.is_active} joined={_fmt(u.date_joined)} last_login={_fmt(u.last_login)}')

        out(self.style.MIGRATE_HEADING('\n2. Active admin-level assignments'))
        qs = recent(UserAssignment.objects.filter(is_active=True)
                    .select_related('user', 'role', 'org_unit', 'created_by__user')
                    .order_by('-created_at'))
        for a in qs:
            if assignment_tier(a) <= TIER_OPERATIONAL:
                continue
            creator = a.created_by.user.username if a.created_by else 'unknown'
            note = ''
            if a.created_by is None:
                note = '  <-- no recorded creator, check with HR/admin'
                flagged += 1
            elif assignment_tier(a.created_by) <= assignment_tier(a) and not a.created_by.user.is_superuser:
                note = '  <-- granted by someone not above this level'
                flagged += 1
            out(f'  {a.user.username:<20} {a.role.code:<15} at {a.org_unit.code:<10} '
                f'created={_fmt(a.created_at)} by={creator}{note}')

        out(self.style.MIGRATE_HEADING('\n3. Roles (newest first) - any you do not recognise?'))
        for r in recent(Role.objects.order_by('-created_at')):
            out(f'  {r.code:<25} active={r.is_active} created={_fmt(r.created_at)} updated={_fmt(r.updated_at)}')

        out(self.style.MIGRATE_HEADING('\n4. Departments (newest first)'))
        for d in recent(Department.objects.order_by('-created_at')):
            out(f'  {d.code:<25} created={_fmt(d.created_at)} updated={_fmt(d.updated_at)}')

        out(self.style.MIGRATE_HEADING('\n5. Approved data-exposure policies'))
        for p in recent(DataExposurePolicy.objects.filter(status='APPROVED')
                        .select_related('created_by__user', 'approved_by__user', 'source_org_unit', 'target_org_unit')):
            maker = p.created_by.user.username if p.created_by else 'unknown'
            checker = p.approved_by.user.username if p.approved_by else 'unknown'
            note = ''
            if p.approved_by is None or (p.created_by and p.created_by.user_id == p.approved_by.user_id):
                note = '  <-- no independent approver'
                flagged += 1
            out(f'  {p.code:<20} {p.source_org_unit.code}->{p.target_org_unit.code} {p.module:<10} '
                f'by={maker} approved_by={checker}{note}')

        out(self.style.MIGRATE_HEADING('\n6. Role-management API calls in the audit log'))
        logs = AuditLog.objects.filter(request_path__regex=r'/api/auth/(roles|departments|user-assignments|data-exposure)')
        logs = logs.exclude(request_method='GET').select_related('user').order_by('-timestamp')
        if since:
            logs = logs.filter(timestamp__gte=since)
        for log in logs[:500]:
            out(f'  {_fmt(log.timestamp)} {log.user.username:<20} {log.request_method:<6} {log.request_path}')
        out('  (Admins without a legacy profile were not audited before Phase 0, so this list may be incomplete.)')

        out('')
        if flagged:
            out(self.style.WARNING(f'{flagged} item(s) flagged for review.'))
        else:
            out(self.style.SUCCESS('Nothing flagged. Still read sections 1-4 for names you do not recognise.'))
