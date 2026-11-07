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
    while it is on remand, or convicted with restitution not yet paid or waived.
    """
    from .models import Restitution

    status = (offence.Offence_status or "").upper()
    if status == "UNCONVICTED":
        return True
    if status == "CONVICTED":
        return (
            Restitution.objects.filter(offence=offence)
            .exclude(status__iexact="paid")
            .exclude(status__iexact="waived")
            .exists()
        )
    return False


def concurrent_offence_ids(conviction):
    """Other offences whose sentences run alongside this one."""
    if not conviction or not conviction.sentence_group_id:
        return []
    return list(
        Convicted.objects.filter(sentence_group_id=conviction.sentence_group_id)
        .exclude(pk=conviction.pk)
        .values_list("offence_id", flat=True)
    )
