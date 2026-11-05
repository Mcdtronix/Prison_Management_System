"""
Mailbox Context Middleware
==========================
Attaches the requesting user's messaging mailbox to the request.

    request.mailbox: Messaging.Mailbox for the user's primary assignment
                     (their department at their org unit), or None.

Mailbox addresses identify a department at an org unit, for example:
    - reception@chivhu: Reception dept @ Chivhu station
    - health@harare-prov: Health dept @ Harare province
    - stores@nat-hq: Stores dept @ National HQ

There are no recipient restrictions: any mailbox may start a conversation
with any other active mailbox (see Messaging/views.py).
"""

import logging

from django.utils.deprecation import MiddlewareMixin

from Auth.models import Department, OrgUnit, OrgUnitDepartment

logger = logging.getLogger(__name__)


class MailboxContextMiddleware(MiddlewareMixin):
    """Resolve the caller's mailbox from the org context set by OrgContextMiddleware."""

    def process_request(self, request):
        request.mailbox = None

        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return None

        # Superusers without an assignment act as National HQ Administration.
        if not getattr(request, 'org_unit', None) and user.is_superuser:
            request.org_unit = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
        if not getattr(request, 'department', None) and user.is_superuser:
            request.department = Department.objects.filter(code='ADMINISTRATION').first()

        if not getattr(request, 'org_unit', None) or not getattr(request, 'department', None):
            return None

        try:
            # The user's own department at their own unit; created on first use.
            oud = OrgUnitDepartment.objects.filter(
                org_unit=request.org_unit, department=request.department, active=True,
            ).first()
            if oud is None:
                oud = OrgUnitDepartment.objects.create(
                    org_unit=request.org_unit, department=request.department, active=True,
                )

            from Messaging.models import Mailbox
            request.mailbox, _ = Mailbox.objects.get_or_create(
                org_unit_department=oud, defaults={'mailbox_address': oud.mailbox_address},
            )
        except Exception as exc:
            logger.error('Error setting mailbox context for %s: %s', user.username, exc)

        return None
