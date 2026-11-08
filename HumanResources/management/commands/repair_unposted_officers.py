"""Gives a station posting to officers saved without one.

Until 8 Nov 2026, adding an officer at a station created in the console saved
the officer but silently skipped their posting (see HumanResources/views.py),
so they appeared in no station's list. This finds those officers and posts
each one to the station of the account that added them, worked out from the
audit log entry written as the officer was created.

Shows the plan only. Add --apply to write it.

    python manage.py repair_unposted_officers            # show what would change
    python manage.py repair_unposted_officers --apply    # post them
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.db.models.functions import Upper

from Auth.models import AuditLog
from Auth.utils import get_primary_assignment, legacy_station_for_unit
from HumanResources.models import Officer, OfficerStationHistory

# The audit entry is written when the response is sent, a moment after the
# officer row; anything further apart is not trusted as a match.
MATCH_WINDOW = timedelta(seconds=15)


class Command(BaseCommand):
    help = 'Posts officers who have no station posting to the station of the account that added them.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write the postings (default: show the plan only).')

    def handle(self, *args, apply=False, **options):
        usernames = get_user_model().objects.annotate(u=Upper('username')).values('u')
        # An explicit subquery: excluding on the relation would also drop officers
        # with no posting rows at all (the missing row reads as "not transferred").
        open_posting = OfficerStationHistory.objects.filter(officer=OuterRef('pk'), date_transferred__isnull=True)
        unposted = (Officer.objects
                    .filter(~Exists(open_posting))                             # no open posting
                    .filter(system_account__isnull=True)                        # not someone's account
                    .annotate(sn=Upper('service_number')).exclude(sn__in=usernames)
                    .order_by('created_at'))

        if not unposted.exists():
            self.stdout.write('No officers without a posting. Nothing to do.')
            return

        planned, unresolved = [], []
        for officer in unposted:
            entry = (AuditLog.objects
                     .filter(request_method='POST', request_path='/api/hr/officers/', remarks__startswith='status=201',
                             timestamp__gte=officer.created_at, timestamp__lte=officer.created_at + MATCH_WINDOW)
                     .select_related('user').order_by('timestamp').first())
            assignment = get_primary_assignment(entry.user) if entry and entry.user else None
            unit = assignment.org_unit if assignment else None
            if unit is None or unit.unit_type != 'STATION':
                unresolved.append((officer, entry.user.username if entry and entry.user else 'unknown'))
                continue
            planned.append((officer, unit, entry.user.username))

        for officer, unit, by in planned:
            self.stdout.write(f'POST  {officer.service_number}  added {officer.created_at:%Y-%m-%d %H:%M} '
                              f'by {by}  ->  {unit.code} ({unit.name})')
        for officer, by in unresolved:
            self.stdout.write(f'SKIP  {officer.service_number}  added {officer.created_at:%Y-%m-%d %H:%M} '
                              f'by {by}: creator is not at a station; post this officer by hand')

        if not apply:
            self.stdout.write(f'\nPlan only: {len(planned)} to post, {len(unresolved)} to skip. '
                              f'Run again with --apply to write the postings.')
            return

        with transaction.atomic():
            for officer, unit, by in planned:
                OfficerStationHistory.objects.create(
                    officer=officer, station=legacy_station_for_unit(unit, create=True), posting_org_unit=unit,
                    date_posted=officer.date_of_attestation, posted_by=f'{by} (repaired)',
                )
        self.stdout.write(self.style.SUCCESS(f'\nPosted {len(planned)} officer(s). {len(unresolved)} skipped.'))
