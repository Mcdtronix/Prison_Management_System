"""
Discharging an inmate from custody, in one place.

Both approval paths (Admin approval of a reception proposal, and the
inmate-level approve_discharge action) call discharge_inmate(), so every
discharge records the same facts: status DISCHARGED, the discharge date, who
approved it, and an audit trail entry. Discharged inmates leave the inmate
list and appear in the Discharge Diary for DIARY_YEARS years, matching the
archive policy in management/commands/archive_old_discharges.py.
"""
import datetime

from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.utils import timezone

DIARY_YEARS = 5


def diary_start(today=None):
    """First date shown in the Discharge Diary (calendar years, leap-safe)."""
    today = today or timezone.localdate()
    return today - relativedelta(years=DIARY_YEARS)


@transaction.atomic
def discharge_inmate(inmate, user, *, when=None, remarks=None):
    from .models import InmateAuditTrail

    when = when or timezone.localdate()
    if isinstance(when, datetime.datetime):
        when = when.date()
    username = getattr(user, "username", None) or "System"

    inmate.current_status = "DISCHARGED"
    inmate.discharge_date = when
    inmate.discharged_by = username
    inmate.save(update_fields=["current_status", "discharge_date", "discharged_by", "updated_at"])

    InmateAuditTrail.objects.create(
        inmate=inmate,
        action=f"Discharged from custody on {when:%d %b %Y}",
        performed_by=username,
        remarks=remarks or None,
    )
    return inmate
