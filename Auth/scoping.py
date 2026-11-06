"""
Station scoping for people lists
================================
Answers one question for the officer and account lists: which people may a
signed-in user see?

A user sees the people at the org units they are assigned to and every unit
below them. A Chivhu Administration officer sees Chivhu only; a provincial
admin sees every station in the province; National HQ sees everyone.

Who created a record never matters, only where the person is now. Two
generations of data are matched so nobody slips through:

- Officers (HR records) belong to a station through their open posting
  (`OfficerStationHistory` with no transfer date), matched by org unit or by
  the equivalent legacy station. Officers whose accounts were made from the
  system-admin console may have no posting row, so an active account at a
  unit in scope also places the officer there.
- Accounts belong to a station through an active `UserAssignment` there, or
  an old-style `UserProfile` at the equivalent legacy station.
"""

from dataclasses import dataclass
from typing import FrozenSet, Optional

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.db.models.functions import Upper

from .models import OrgUnit, UserAssignment
from .rbac import _assignments, descendant_ids, is_national_admin
from .utils import legacy_station_for_unit, normalize_role_code


@dataclass(frozen=True)
class PeopleScope:
    """Org units (and matching legacy stations) whose people a user may see."""

    unit_ids: Optional[FrozenSet[int]]  # None means everywhere
    station_ids: FrozenSet[int] = frozenset()

    @property
    def everywhere(self) -> bool:
        return self.unit_ids is None


EVERYWHERE = PeopleScope(unit_ids=None)
NOWHERE = PeopleScope(unit_ids=frozenset())


def _active_profile(user):
    profile = getattr(user, 'userprofile', None)
    return profile if profile is not None and profile.is_active else None


def people_scope(user) -> PeopleScope:
    """Where `user` may see officers and accounts."""
    if not (user and user.is_authenticated):
        return NOWHERE
    if is_national_admin(user):
        return EVERYWHERE

    profile = _active_profile(user)
    if profile is not None and normalize_role_code(profile.role.code) == 'SUPER_ADMIN':
        return EVERYWHERE  # legacy all-powerful accounts

    roots = {a.org_unit_id for a in _assignments(user)}
    if roots:
        unit_ids = descendant_ids(roots)
        station_ids = {
            station.pk
            for unit in OrgUnit.objects.filter(pk__in=unit_ids, unit_type='STATION')
            if (station := legacy_station_for_unit(unit)) is not None
        }
        return PeopleScope(frozenset(unit_ids), frozenset(station_ids))

    # Old-style accounts with no assignments: their profile's station only.
    if profile is not None:
        return PeopleScope(frozenset(), frozenset({profile.station_id}))
    return NOWHERE


def _accounts_q(scope: PeopleScope) -> Q:
    """Users with an account at a unit in scope."""
    return (
        Q(org_assignments__is_active=True, org_assignments__org_unit_id__in=scope.unit_ids)
        | Q(userprofile__station_id__in=scope.station_ids)
    )


def officers_in_scope(queryset, scope: PeopleScope):
    """Narrow an `Officer` queryset to the officers currently at units in scope."""
    if scope.everywhere:
        return queryset

    # One Q inside one filter() keeps both conditions on the same posting row.
    posted_here = Q(station_history__date_transferred__isnull=True) & (
        Q(station_history__posting_org_unit_id__in=scope.unit_ids)
        | Q(station_history__station_id__in=scope.station_ids)
    )
    usernames_here = (
        get_user_model().objects.filter(_accounts_q(scope)).annotate(sn=Upper('username')).values('sn')
    )
    return (
        queryset.annotate(_sn=Upper('service_number'))
        .filter(posted_here | Q(_sn__in=usernames_here))
        .distinct()
    )


def accounts_in_scope(scope: PeopleScope):
    """Account rows for the people list, in the shape of `UserProfileSerializer`.

    `id` is the old-style profile id (used to activate/deactivate) and is None
    for accounts made from the console; `user_id` is always set.
    """
    from HumanResources.models import Officer

    User = get_user_model()
    users = User.objects.all() if scope.everywhere else User.objects.filter(_accounts_q(scope))
    if scope.everywhere:
        users = users.filter(Q(org_assignments__is_active=True) | Q(userprofile__isnull=False))

    assignments = UserAssignment.objects.filter(is_active=True).select_related('role', 'org_unit')
    if not scope.everywhere:
        assignments = assignments.filter(org_unit_id__in=scope.unit_ids)
    users = (
        users.distinct()
        .select_related('userprofile__role', 'userprofile__station', 'userprofile__officer')
        .prefetch_related(Prefetch(
            'org_assignments',
            queryset=assignments.order_by('-is_primary', 'pk'),
            to_attr='assignments_here',
        ))
        .order_by('username')
    )
    users = list(users)

    officers = {
        o.service_number.upper(): o
        for o in Officer.objects.filter(service_number__in=[u.username.upper() for u in users])
    }

    rows = []
    for u in users:
        profile = getattr(u, 'userprofile', None)
        assignment = u.assignments_here[0] if u.assignments_here else None
        officer = (profile.officer if profile is not None else None) or officers.get(u.username.upper())

        if assignment is not None:
            role, unit_name, unit_code = assignment.role, assignment.org_unit.name, assignment.org_unit.code
        elif profile is not None:
            role, unit_name, unit_code = profile.role, profile.station.name, profile.station.code
        else:
            continue

        rows.append({
            'id': profile.pk if profile is not None else None,
            'user_id': u.pk,
            'username': u.username,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'officer_service_number': officer.service_number if officer else u.username,
            'officer_name': (
                ' '.join(n for n in (officer.first_name, officer.other_names, officer.surname) if n)
                if officer else None
            ),
            'role_name': role.name,
            'role_code': normalize_role_code(role.code),
            'station_name': unit_name,
            'station_code': unit_code,
            'is_active': u.is_active and (profile is None or profile.is_active),
            'created_at': (profile.created_at if profile is not None else u.date_joined),
        })
    return rows
