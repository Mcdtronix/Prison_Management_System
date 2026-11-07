"""
Concurrent and consecutive sentencing, shared by offence registration and
Record Court Outcome so both behave the same way.

A count either runs consecutively (no group) or concurrently with other counts
(same concurrent SentenceGroup). calculate_inmate_release_dates() counts each
concurrent group once, at its longest sentence, and adds groups and lone counts
one after another. Example: 36 months concurrent with 24, then 12 = 48 months.
"""
from django.db import transaction
from rest_framework import serializers

from .models import Convicted, SentenceGroup, calculate_inmate_release_dates


def _months(conviction):
    return conviction.sentence_years * 12 + conviction.sentence_months


def _refresh_group(group):
    """Keep a group's summary fields current; dissolve groups of one or none."""
    members = list(Convicted.objects.filter(sentence_group=group))
    if len(members) <= 1:
        Convicted.objects.filter(sentence_group=group).update(sentence_group=None)
        group.delete()
        return
    dates = [m.date_of_sentence for m in members if m.date_of_sentence]
    group.date_of_sentence = min(dates) if dates else group.date_of_sentence
    group.duration_months = max(_months(m) for m in members)
    group.save(update_fields=["date_of_sentence", "duration_months"])


def resolve_concurrent_target(inmate, offence_id, *, exclude_offence_id=None):
    """The conviction a count should run alongside, validated for this inmate."""
    if offence_id in (None, "", 0):
        return None
    if exclude_offence_id is not None and int(offence_id) == int(exclude_offence_id):
        raise serializers.ValidationError({"concurrent_with": "A count cannot run concurrently with itself."})
    target = (
        Convicted.objects.select_related("offence", "sentence_group")
        .filter(offence_id=offence_id, offence__inmate=inmate)
        .first()
    )
    if target is None:
        raise serializers.ValidationError(
            {"concurrent_with": "The selected count is not a convicted offence of this inmate."}
        )
    return target


@transaction.atomic
def set_concurrency(conviction, target=None, *, recalculate=True):
    """
    Make `conviction` run concurrently with `target`, or consecutively when
    `target` is None. Joins the target's existing concurrent group if it has one.
    """
    previous = conviction.sentence_group

    if target is None:
        conviction.sentence_group = None
    else:
        if target.pk == conviction.pk:
            raise serializers.ValidationError({"concurrent_with": "A count cannot run concurrently with itself."})
        group = target.sentence_group if target.sentence_group and target.sentence_group.is_concurrent else None
        if group is None:
            dates = [d for d in (target.date_of_sentence, conviction.date_of_sentence) if d]
            group = SentenceGroup.objects.create(
                inmate=conviction.prison_number,
                date_of_sentence=min(dates) if dates else conviction.prison_number.admission_date,
                duration_months=max(_months(target), _months(conviction)),
                is_concurrent=True,
                remarks="Counts ordered to run concurrently",
            )
            Convicted.objects.filter(pk=target.pk).update(sentence_group=group)
            target.sentence_group = group
        conviction.sentence_group = group

    Convicted.objects.filter(pk=conviction.pk).update(sentence_group=conviction.sentence_group)

    if previous and previous != conviction.sentence_group:
        _refresh_group(previous)
    if conviction.sentence_group:
        _refresh_group(conviction.sentence_group)

    if recalculate:
        calculate_inmate_release_dates(conviction.prison_number)


NO_COURT_MATTER = (
    "This offence has no court matter pending: it is sentenced with no restitution "
    "outstanding. Use Edit Offences to correct the sentence."
)


def court_matter_pending(offence):
    """
    Same rule as the frontend (src/lib/court.ts): an offence is before the court
    while it is on remand, convicted with restitution not yet paid or waived, or
    convicted with a confirmation of sentence (reduction / increase) awaiting court.
    """
    from .models import Restitution

    status = (offence.Offence_status or "").upper()
    if status == "UNCONVICTED":
        return True
    if status == "CONVICTED":
        if pending_confirmation(offence):
            return True  # a reduction / increase awaits its court session
        return (
            Restitution.objects.filter(offence=offence)
            .exclude(status__iexact="paid")
            .exclude(status__iexact="waived")
            .exists()
        )
    return False


def earliest_court_date(offence):
    """
    The earliest date a court session can be recorded for `offence`: the remand
    start for a remand matter, otherwise the date of sentence. None if unknown.
    """
    unconviction = getattr(offence, "unconviction", None)
    if unconviction is not None and unconviction.remand_start_date:
        return unconviction.remand_start_date
    try:
        return offence.conviction.date_of_sentence
    except Convicted.DoesNotExist:
        return None


def close_scheduled_sessions(offence, recorded):
    """
    Settle the offence's scheduled sessions once a court outcome is recorded:
    those on or before the session just recorded were answered by it, and once
    no court matter is left, later ones are cancelled. Returns how many closed.
    """
    from .models import CourtSession

    open_sessions = CourtSession.objects.filter(offence=offence, outcome="SCHEDULED").exclude(pk=recorded.pk)
    answered = open_sessions.filter(session_date__lte=recorded.session_date)
    if not court_matter_pending(offence):
        answered = open_sessions
    note = f"Closed: outcome {recorded.get_outcome_display()} recorded on {recorded.session_date:%d/%m/%Y}."
    closed = 0
    for session in answered:
        session.outcome = "CANCELLED"
        session.next_court_date = None
        session.remarks = "; ".join(filter(None, [session.remarks, note]))
        session.save(update_fields=["outcome", "next_court_date", "remarks"])
        closed += 1
    return closed


def concurrent_offence_ids(conviction):
    """Other offences whose sentences run alongside this one."""
    if not conviction or not conviction.sentence_group_id:
        return []
    return list(
        Convicted.objects.filter(sentence_group_id=conviction.sentence_group_id)
        .exclude(pk=conviction.pk)
        .values_list("offence_id", flat=True)
    )


# ---------------------------------------------------------------------------
# Confirmation of sentence
# ---------------------------------------------------------------------------

def describe_sentence(years=0, months=0, days=0):
    return f"{years}y {months}m {days}d"


def _sentence_days(start, years, months, days):
    from dateutil.relativedelta import relativedelta

    if not start:
        return years * 365 + months * 30 + days
    return ((start + relativedelta(years=years, months=months, days=days)) - start).days


def pending_confirmation(offence):
    """The confirmation of sentence still waiting on a court session, if any."""
    from .models import SentenceConfirmation

    return (
        SentenceConfirmation.objects.select_related("court_session")
        .filter(offence=offence, status=SentenceConfirmation.AWAITING_COURT)
        .first()
    )


def _audit(inmate, action, user, remarks=None):
    from .models import InmateAuditTrail

    InmateAuditTrail.objects.create(
        inmate=inmate,
        action=action[:200],
        performed_by=getattr(user, "username", None) or "System",
        remarks=remarks,
    )


@transaction.atomic
def record_confirmation(offence, *, outcome, confirmation_date, document, user, remarks=None, court_date=None):
    """
    Store a confirmation of sentence with its document. Endorsed: closed at once.
    Reduced / increased: schedules the court session that will re-sentence.
    """
    from .models import CourtSession, SentenceConfirmation

    conviction = getattr(offence, "conviction", None)
    if offence.Offence_status != "CONVICTED" or conviction is None:
        raise serializers.ValidationError({"offence": "Only a convicted offence can have its sentence confirmed."})
    if pending_confirmation(offence):
        raise serializers.ValidationError(
            {"offence": "A confirmation of sentence for this offence is already awaiting its court session."}
        )
    revising = outcome in (SentenceConfirmation.REDUCED, SentenceConfirmation.INCREASED)
    if revising and not court_date:
        raise serializers.ValidationError(
            {"court_date": "A court date is required when the sentence is reduced or increased."}
        )

    confirmation = SentenceConfirmation.objects.create(
        offence=offence,
        outcome=outcome,
        status=SentenceConfirmation.AWAITING_COURT if revising else SentenceConfirmation.COMPLETED,
        confirmation_date=confirmation_date,
        document=document,
        remarks=remarks or None,
        previous_date_of_sentence=conviction.date_of_sentence,
        previous_sentence_years=conviction.sentence_years,
        previous_sentence_months=conviction.sentence_months,
        previous_sentence_days=conviction.sentence_days,
        recorded_by=getattr(user, "username", None) or "System",
    )
    current = describe_sentence(conviction.sentence_years, conviction.sentence_months, conviction.sentence_days)
    label = confirmation.get_outcome_display().lower()
    _audit(
        offence.inmate,
        f"Confirmation of sentence recorded for '{offence.offence_description[:40]}': {label}",
        user,
        remarks=f"Document dated {confirmation_date:%d %b %Y}. Sentence on record: {current}. {remarks or ''}".strip(),
    )

    if revising:
        session = CourtSession.objects.create(
            offence=offence,
            session_date=court_date,
            next_court_date=court_date,
            outcome="SCHEDULED",
            remarks=f"Confirmation of sentence: {label}. Revised sentence to be passed.",
            warrant_document=confirmation.document.name,
        )
        confirmation.court_session = session
        confirmation.save(update_fields=["court_session"])
        _audit(
            offence.inmate,
            f"Court session scheduled for {court_date:%d %b %Y} following confirmation of sentence ({label})",
            user,
        )
    return confirmation


def check_revision_direction(confirmation, years, months, days):
    """A reduction must shorten the sentence and an increase must lengthen it."""
    from .models import SentenceConfirmation

    start = confirmation.previous_date_of_sentence
    before = _sentence_days(start, confirmation.previous_sentence_years,
                            confirmation.previous_sentence_months, confirmation.previous_sentence_days)
    after = _sentence_days(start, years, months, days)
    previous = describe_sentence(confirmation.previous_sentence_years, confirmation.previous_sentence_months,
                                 confirmation.previous_sentence_days)
    if confirmation.outcome == SentenceConfirmation.REDUCED and not after < before:
        raise serializers.ValidationError(
            {"sentence": f"The confirmation reduces the sentence: the revised sentence must be shorter than {previous}."}
        )
    if confirmation.outcome == SentenceConfirmation.INCREASED and not after > before:
        raise serializers.ValidationError(
            {"sentence": f"The confirmation increases the sentence: the revised sentence must be longer than {previous}."}
        )


def apply_confirmation(confirmation, conviction, user, session_date):
    """Close a confirmation once the court has passed the revised sentence."""
    from django.utils import timezone
    from .models import SentenceConfirmation

    confirmation.status = SentenceConfirmation.APPLIED
    confirmation.revised_sentence_years = conviction.sentence_years
    confirmation.revised_sentence_months = conviction.sentence_months
    confirmation.revised_sentence_days = conviction.sentence_days
    confirmation.applied_by = getattr(user, "username", None) or "System"
    confirmation.applied_at = timezone.now()
    confirmation.save()

    before = describe_sentence(confirmation.previous_sentence_years, confirmation.previous_sentence_months,
                               confirmation.previous_sentence_days)
    after = describe_sentence(conviction.sentence_years, conviction.sentence_months, conviction.sentence_days)
    verb = "reduced" if confirmation.outcome == SentenceConfirmation.REDUCED else "increased"
    remarks = f"Passed at court session {session_date:%d %b %Y} following confirmation of sentence dated {confirmation.confirmation_date:%d %b %Y}."
    if confirmation.previous_date_of_sentence:
        remarks += f" Sentence date kept at {confirmation.previous_date_of_sentence:%d %b %Y} for remission."
    _audit(
        conviction.prison_number,
        f"Sentence {verb} from {before} to {after} for '{conviction.offence.offence_description[:40]}'",
        user,
        remarks=remarks,
    )


def confirmation_payload(confirmation, request=None):
    """Serialised confirmation for the inmate details API."""
    doc_url = confirmation.document.url if confirmation.document else None
    if doc_url and request is not None:
        doc_url = request.build_absolute_uri(doc_url)
    revised = None
    if confirmation.revised_sentence_years is not None:
        revised = {
            "years": confirmation.revised_sentence_years,
            "months": confirmation.revised_sentence_months or 0,
            "days": confirmation.revised_sentence_days or 0,
        }
    return {
        "id": confirmation.id,
        "outcome": confirmation.outcome,
        "outcome_display": confirmation.get_outcome_display(),
        "status": confirmation.status,
        "status_display": confirmation.get_status_display(),
        "confirmation_date": confirmation.confirmation_date,
        "document": doc_url,
        "remarks": confirmation.remarks,
        "previous": {
            "years": confirmation.previous_sentence_years,
            "months": confirmation.previous_sentence_months,
            "days": confirmation.previous_sentence_days,
            "date_of_sentence": confirmation.previous_date_of_sentence,
        },
        "revised": revised,
        "court_date": confirmation.court_session.session_date if confirmation.court_session else None,
        "recorded_by": confirmation.recorded_by,
        "recorded_at": confirmation.recorded_at,
        "applied_by": confirmation.applied_by,
        "applied_at": confirmation.applied_at,
    }
