"""Admin console API: one set of endpoints, scoped to the caller's own area.

HQ System Admins see the whole country; provincial and station admins (next
phase) get the same screens limited to their province or station. Every
query goes through `admin_scope`, and every change through `can_manage_user`
or `can_grant`, so the scope and grant rules are enforced on the server.

Mounted at /api/auth/console/.
"""
import re
import secrets
import string
from collections import defaultdict
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (AuditLog, Department, LoginEvent, OrgUnit, Role, UserAssignment, UserSecurity,
                     UserSession)
from .capabilities import SYSTEM_ADMIN_LIMITS, SYSTEM_ADMIN_ROLE_FOR_UNIT
from .rbac import (admin_scope, can, can_grant, can_manage_user, descendant_ids, grantable_roles, is_national_admin,
                   system_admin_slot_problem, system_admin_slots)
from .sessions import ONLINE_WINDOW, online_sessions, revoke_sessions
from .usage import compute_org_usage, database_size, latest_snapshot
from .utils import create_audit_log, get_primary_assignment, revoke_user_tokens
from .views_audit import visible_audit_logs

User = get_user_model()

SERVICE_NUMBER = re.compile(r'^[0-9]{7}[A-Z]$')
MIN_REASON = 5


# ------------------------------------------------------------------ helpers

class ConsolePage(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 200


class IsConsoleUser(permissions.BasePermission):
    """Anyone who may view accounts somewhere (HQ, provincial or station admins)."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        scope = admin_scope(user, 'users.view')
        return scope is None or bool(scope)


def _scope(request):
    return admin_scope(request.user, 'users.view')


def _units_in_scope(request):
    ids = _scope(request)
    qs = OrgUnit.objects.all()
    return qs if ids is None else qs.filter(id__in=ids)


def _org_filter(request):
    """Optional ?org_unit=ID, limited to the caller's scope; returns a set of unit ids or None."""
    raw = request.query_params.get('org_unit')
    scope = _scope(request)
    if not raw:
        return scope
    try:
        unit = OrgUnit.objects.get(pk=int(raw))
    except (ValueError, OrgUnit.DoesNotExist):
        raise NotFound('Unknown org unit.')
    if scope is not None and unit.pk not in scope:
        raise PermissionDenied('That unit is outside your area.')
    return descendant_ids([unit.pk])


def _users_in(ids):
    """Users with an active assignment inside `ids` (None = every user)."""
    qs = User.objects.all()
    if ids is None:
        return qs
    return qs.filter(org_assignments__org_unit_id__in=ids, org_assignments__is_active=True).distinct()


def _user_or_404(request, pk):
    user = _users_in(_scope(request)).filter(pk=pk).first()
    if user is None:
        raise NotFound('User not found in your area.')
    return user


def normalize_service_number(raw):
    """Upper-cased, trimmed service number, or a ValidationError if it is not 7 digits + a letter."""
    value = (raw or '').strip().upper()
    if not SERVICE_NUMBER.match(value):
        raise ValidationError({'service_number': [
            "Use the officer's service number: 7 digits and a letter, e.g. 1234567A."]})
    return value


def _unit_for_admin(request, raw, active_only=False):
    """The org unit `raw` names, if it is inside the caller's area."""
    try:
        unit = OrgUnit.objects.select_related('parent').get(pk=int(raw))
    except (TypeError, ValueError, OrgUnit.DoesNotExist):
        raise ValidationError({'org_unit': ['Choose a province or station.']})
    if active_only and not unit.active:
        raise ValidationError({'org_unit': [f'{unit.name} is inactive.']})
    scope = _scope(request)
    if scope is not None and unit.pk not in scope:
        raise PermissionDenied('That unit is outside your area.')
    return unit


def _admin_role_for(unit):
    """The system-admin role created at this unit's level (None at National HQ)."""
    code = SYSTEM_ADMIN_ROLE_FOR_UNIT.get(unit.unit_type)
    return Role.objects.select_related('department').filter(code=code, is_active=True).first() if code else None


def _system_admin_problem(user, role, unit):
    """None if `user` may add another `role` holder at `unit` now, otherwise the reason."""
    if role is None:
        return 'System admins are created at a province or a station.'
    if not (user.is_superuser or can(user, 'users.create', unit)):
        return 'You cannot create accounts here.'
    return can_grant(user, role, unit) or system_admin_slot_problem(role, unit)


def _officer_names(service_number):
    """First name and surname from the HR record with this service number, if there is one."""
    try:
        from HumanResources.models import Officer
        officer = Officer.objects.filter(service_number=service_number).first()
    except Exception:
        officer = None
    return (officer.first_name, officer.surname) if officer else ('', '')


def _reason(request):
    reason = (request.data.get('reason') or '').strip()
    if len(reason) < MIN_REASON:
        raise ValidationError({'reason': [f'Give a reason (at least {MIN_REASON} characters). It is kept in the audit log.']})
    return reason


def _require_manage(request, target):
    if not can(request.user, 'users.manage') and not request.user.is_superuser:
        raise PermissionDenied('You cannot manage accounts.')
    problem = can_manage_user(request.user, target)
    if problem:
        raise PermissionDenied(problem)


def _audit(request, action_name, target, remarks):
    create_audit_log(request.user, action=action_name, module='RBAC', object_type='User',
                     object_id=target.pk, remarks=remarks, role=_actor_role(request.user))


def _actor_role(user):
    a = get_primary_assignment(user)
    if a:
        return a.role.code
    return 'SUPERUSER' if user.is_superuser else 'UNKNOWN'


def temporary_password(user=None):
    """A readable one-time password that passes the configured validators, e.g. 'Kq7m-Tx4p-Wz9r'."""
    alphabet = string.ascii_letters + string.digits
    while True:
        groups = [''.join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
        candidate = '-'.join(groups)
        if not (any(c.isupper() for c in candidate) and any(c.islower() for c in candidate)
                and any(c.isdigit() for c in candidate)):
            continue
        try:
            validate_password(candidate, user=user)
            return candidate
        except DjangoValidationError:
            continue


def password_info(user, security=None):
    """What an admin may know about a password: how it is stored, never the hash itself."""
    algorithm, iterations = None, None
    if user.has_usable_password():
        parts = user.password.split('$')
        algorithm = parts[0] if parts else None
        if len(parts) > 1 and parts[1].isdigit():
            iterations = int(parts[1])
    security = security or getattr(user, 'security', None)
    return {
        'usable': user.has_usable_password(),
        'algorithm': algorithm,
        'iterations': iterations,
        'changed_at': security.password_changed_at if security else None,
        'reset_at': security.password_reset_at if security else None,
        'must_change': bool(security and security.must_change_password),
        'failed_attempts': security.failed_login_count if security else 0,
        'last_failed_at': security.last_failed_login_at if security else None,
    }


def _assignment_row(a):
    return {
        'id': a.id, 'role_id': a.role_id, 'role_code': a.role.code, 'role_name': a.role.name,
        'org_unit_id': a.org_unit_id, 'org_unit_code': a.org_unit.code, 'org_unit_name': a.org_unit.name,
        'org_unit_type': a.org_unit.unit_type, 'department_code': a.department.code,
        'department_name': a.department.name, 'is_primary': a.is_primary, 'is_active': a.is_active,
        'created_at': a.created_at,
    }


def _online_user_ids():
    return set(online_sessions().values_list('user_id', flat=True))


def _user_row(user, online_ids):
    assignments = [a for a in user.org_assignments.all() if a.is_active]
    primary = next((a for a in assignments if a.is_primary), assignments[0] if assignments else None)
    last_seen = max((s.last_seen_at for s in user.sessions.all()), default=None)
    return {
        'id': user.id,
        'username': user.username,
        'full_name': f'{user.first_name} {user.last_name}'.strip(),
        'email': user.email,
        'is_active': user.is_active,
        'is_superuser': user.is_superuser,
        'online': user.id in online_ids,
        'last_login': user.last_login,
        'last_seen': last_seen,
        'date_joined': user.date_joined,
        'primary_role': primary.role.name if primary else None,
        'primary_role_code': primary.role.code if primary else None,
        'primary_unit': primary.org_unit.name if primary else None,
        'primary_unit_id': primary.org_unit_id if primary else None,
        'department': primary.department.name if primary else None,
        'assignments': [_assignment_row(a) for a in assignments],
        'password': password_info(user),
    }


def _audit_row(log):
    return {
        'id': log.id, 'timestamp': log.timestamp, 'user_id': log.user_id,
        'username': log.user.username if log.user_id else None,
        'full_name': f'{log.user.first_name} {log.user.last_name}'.strip() if log.user_id else '',
        'role': log.role, 'action': log.action, 'module': log.module,
        'method': log.request_method, 'path': log.request_path, 'ip_address': log.ip_address,
        'remarks': log.remarks, 'object_type': log.object_type, 'object_id': log.object_id,
    }


def _session_row(s, now=None):
    now = now or timezone.now()
    return {
        'id': str(s.id), 'user_id': s.user_id, 'username': s.user.username,
        'full_name': f'{s.user.first_name} {s.user.last_name}'.strip(),
        'org_unit': s.org_unit.name if s.org_unit_id else None,
        'org_unit_id': s.org_unit_id,
        'created_at': s.created_at, 'last_seen_at': s.last_seen_at,
        'ip_address': s.ip_address, 'user_agent': s.user_agent,
        'online': s.revoked_at is None and s.last_seen_at >= now - ONLINE_WINDOW,
        'revoked_at': s.revoked_at, 'revoke_reason': s.revoke_reason,
    }


def _usage_by_unit(rows):
    """Own bytes/rows per unit id from a snapshot batch, plus unassigned and shared totals."""
    per_unit = defaultdict(lambda: {'bytes': 0, 'rows': 0})
    unassigned = {'bytes': 0, 'rows': 0}
    shared = {'bytes': 0, 'rows': 0}
    for r in rows.values('org_unit_id', 'scope').annotate(b=Sum('est_bytes'), n=Sum('row_count')):
        bucket = per_unit[r['org_unit_id']] if r['scope'] == 'OWNED' else (
            unassigned if r['scope'] == 'UNASSIGNED' else shared)
        bucket['bytes'] += r['b'] or 0
        bucket['rows'] += r['n'] or 0
    return per_unit, unassigned, shared


# ------------------------------------------------------------------ viewset

class ConsoleViewSet(viewsets.ViewSet):
    permission_classes = [IsConsoleUser]

    # ---- overview -------------------------------------------------------

    @action(detail=False, methods=['get'])
    def overview(self, request):
        scope = _scope(request)
        units = _units_in_scope(request)
        users = _users_in(scope)
        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        user_ids = None if scope is None else set(users.values_list('id', flat=True))

        logins = LoginEvent.objects.filter(at__gte=day_ago)
        if user_ids is not None:
            logins = logins.filter(user_id__in=user_ids)
        online = online_sessions()
        if user_ids is not None:
            online = online.filter(user_id__in=user_ids)

        rows, captured = latest_snapshot()
        if scope is not None:
            rows = rows.filter(org_unit_id__in=scope)
        storage = rows.aggregate(b=Sum('est_bytes'), n=Sum('row_count'))

        activity = visible_audit_logs(request.user, AuditLog.objects.select_related('user')).order_by('-timestamp')[:8]
        failed = logins.filter(success=False).order_by('-at')[:6]

        return Response({
            'scope': 'NATIONAL' if scope is None else 'LIMITED',
            'counts': {
                'provinces': units.filter(unit_type='PROVINCIAL_HQ').count(),
                'stations': units.filter(unit_type='STATION').count(),
                'users': users.count(),
                'active_users': users.filter(is_active=True).count(),
                'disabled_users': users.filter(is_active=False).count(),
                'online_now': online.values('user_id').distinct().count(),
                'logins_24h': logins.filter(success=True).count(),
                'failed_logins_24h': logins.filter(success=False).count(),
                'pending_password_changes': UserSecurity.objects.filter(
                    must_change_password=True, **({} if user_ids is None else {'user_id__in': user_ids})).count(),
                'departments': Department.objects.filter(active=True).count(),
                'roles': Role.objects.filter(is_active=True).count(),
            },
            'storage': {
                'records_bytes': storage['b'] or 0, 'records': storage['n'] or 0,
                'database_bytes': database_size() if scope is None else None,
                'captured_at': captured,
            },
            'recent_activity': [_audit_row(a) for a in activity],
            'recent_failed_logins': [
                {'username': e.username_attempted, 'at': e.at, 'ip_address': e.ip_address, 'reason': e.reason}
                for e in failed
            ],
        })

    # ---- organisation ---------------------------------------------------

    @action(detail=False, methods=['get'], url_path='org-tree')
    def org_tree(self, request):
        units = list(_units_in_scope(request).select_related('parent').order_by('name'))
        ids = [u.id for u in units]
        users_per_unit = dict(
            UserAssignment.objects.filter(org_unit_id__in=ids, is_active=True)
            .values('org_unit_id').annotate(n=Count('user', distinct=True)).values_list('org_unit_id', 'n'))
        online_per_unit = dict(
            online_sessions().filter(org_unit_id__in=ids).values('org_unit_id')
            .annotate(n=Count('user', distinct=True)).values_list('org_unit_id', 'n'))
        admins_per_unit = dict(
            UserAssignment.objects.filter(org_unit_id__in=ids, is_active=True, user__is_active=True,
                                          role__code__in=list(SYSTEM_ADMIN_ROLE_FOR_UNIT.values()))
            .values('org_unit_id').annotate(n=Count('user', distinct=True)).values_list('org_unit_id', 'n'))
        rows, captured = latest_snapshot()
        usage, unassigned, shared = _usage_by_unit(rows)

        def node(u):
            admin_role = SYSTEM_ADMIN_ROLE_FOR_UNIT.get(u.unit_type)
            return {
                'id': u.id, 'code': u.code, 'code_short': u.code_short, 'name': u.name,
                'unit_type': u.unit_type, 'location': u.location, 'active': u.active,
                'parent_id': u.parent_id, 'users': users_per_unit.get(u.id, 0),
                'online': online_per_unit.get(u.id, 0),
                'storage_bytes': usage[u.id]['bytes'], 'records': usage[u.id]['rows'],
                'system_admins': admins_per_unit.get(u.id, 0),
                'system_admin_limit': SYSTEM_ADMIN_LIMITS.get(admin_role) if admin_role else None,
            }

        stations_by_parent = defaultdict(list)
        for u in units:
            if u.unit_type == 'STATION':
                stations_by_parent[u.parent_id].append(node(u))

        provinces = []
        for u in units:
            if u.unit_type != 'PROVINCIAL_HQ':
                continue
            p = node(u)
            p['stations'] = stations_by_parent.get(u.id, [])
            p['total_users'] = p['users'] + sum(s['users'] for s in p['stations'])
            p['total_online'] = p['online'] + sum(s['online'] for s in p['stations'])
            p['total_storage_bytes'] = p['storage_bytes'] + sum(s['storage_bytes'] for s in p['stations'])
            p['total_records'] = p['records'] + sum(s['records'] for s in p['stations'])
            provinces.append(p)

        national = next((node(u) for u in units if u.unit_type == 'NATIONAL_HQ'), None)
        return Response({
            'scope': 'NATIONAL' if _scope(request) is None else 'LIMITED',
            'national': national,
            'provinces': provinces,
            'storage': {'captured_at': captured, 'unassigned': unassigned, 'shared': shared},
        })

    # ---- users ----------------------------------------------------------

    @action(detail=False, methods=['get', 'post'])
    def users(self, request):
        if request.method == 'POST':
            return self._create_user(request)

        qs = _users_in(_org_filter(request)).prefetch_related(
            'org_assignments__role', 'org_assignments__org_unit', 'org_assignments__department', 'sessions'
        ).select_related('security').order_by('username')

        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
                           | Q(email__icontains=q))
        role = request.query_params.get('role')
        if role:
            qs = qs.filter(org_assignments__role_id=role, org_assignments__is_active=True)
        dept = request.query_params.get('department')
        if dept:
            qs = qs.filter(org_assignments__department_id=dept, org_assignments__is_active=True)
        state = request.query_params.get('status')
        online_ids = _online_user_ids()
        if state == 'active':
            qs = qs.filter(is_active=True)
        elif state == 'disabled':
            qs = qs.filter(is_active=False)
        elif state == 'online':
            qs = qs.filter(id__in=online_ids)
        elif state == 'must_change':
            qs = qs.filter(security__must_change_password=True)

        paginator = ConsolePage()
        page = paginator.paginate_queryset(qs.distinct(), request, view=self)
        return paginator.get_paginated_response([_user_row(u, online_ids) for u in page])

    def _create_user(self, request):
        data = request.data
        username = (data.get('username') or '').strip().upper()
        if not SERVICE_NUMBER.match(username):
            raise ValidationError({'username': ['Use the officer\'s service number, e.g. 1234567A.']})
        if User.objects.filter(username=username).exists():
            raise ValidationError({'username': ['An account with this service number already exists.']})
        first = (data.get('first_name') or '').strip()
        last = (data.get('last_name') or '').strip()
        if not first or not last:
            raise ValidationError({'first_name': ['First name and surname are required.']})
        email = (data.get('email') or '').strip()

        role = Role.objects.filter(pk=data.get('role'), is_active=True).first()
        unit = OrgUnit.objects.filter(pk=data.get('org_unit'), active=True).first()
        if role is None or unit is None:
            raise ValidationError({'role': ['Choose a role and a unit.']})
        problem = can_grant(request.user, role, unit)
        if problem:
            raise PermissionDenied(problem)
        problem = system_admin_slot_problem(role, unit)
        if problem:
            raise ValidationError({'role': [problem]})
        department = role.department or Department.objects.filter(pk=data.get('department'), active=True).first()
        if department is None:
            raise ValidationError({'department': ['Choose a department for this role.']})

        with transaction.atomic():
            user = User(username=username, first_name=first, last_name=last, email=email)
            password = temporary_password(user)
            user.set_password(password)
            user.save()
            UserSecurity.objects.create(user=user, must_change_password=True, password_reset_at=timezone.now(),
                                        password_reset_by=request.user)
            UserAssignment.objects.create(user=user, role=role, org_unit=unit, department=department,
                                          is_primary=True, created_by=get_primary_assignment(request.user))
        _audit(request, 'CREATE_ACCOUNT', user, f'{username} as {role.code} at {unit.code}')
        return Response({
            'id': user.id, 'username': user.username, 'temporary_password': password,
            'message': 'Give this one-time password to the officer in person. They must change it at first sign-in.',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path=r'users/(?P<user_id>\d+)')
    def user_detail(self, request, user_id=None):
        user = _user_or_404(request, user_id)
        security = UserSecurity.objects.filter(user=user).first()
        assignments = UserAssignment.objects.filter(user=user).select_related('role', 'org_unit', 'department')
        now = timezone.now()
        sessions = user.sessions.select_related('org_unit', 'user').order_by('-last_seen_at')[:10]
        logins = user.login_events.order_by('-at')[:10]
        activity = AuditLog.objects.filter(user=user).select_related('user').order_by('-timestamp')[:20]
        online_ids = _online_user_ids()
        return Response({
            'id': user.id, 'username': user.username,
            'first_name': user.first_name, 'last_name': user.last_name,
            'full_name': f'{user.first_name} {user.last_name}'.strip(), 'email': user.email,
            'is_active': user.is_active, 'is_superuser': user.is_superuser,
            'online': user.id in online_ids, 'last_login': user.last_login, 'date_joined': user.date_joined,
            'password': password_info(user, security),
            'assignments': [_assignment_row(a) for a in assignments],
            'sessions': [_session_row(s, now) for s in sessions],
            'logins': [{'at': e.at, 'success': e.success, 'reason': e.reason, 'ip_address': e.ip_address,
                        'user_agent': e.user_agent} for e in logins],
            'activity': [_audit_row(a) for a in activity],
            'can_manage': can_manage_user(request.user, user) is None,
        })

    @action(detail=False, methods=['post'], url_path=r'users/(?P<user_id>\d+)/reset-password')
    def reset_password(self, request, user_id=None):
        target = _user_or_404(request, user_id)
        _require_manage(request, target)
        reason = _reason(request)
        password = temporary_password(target)
        with transaction.atomic():
            target.set_password(password)
            target.save(update_fields=['password'])
            security = UserSecurity.for_user(target)
            security.must_change_password = True
            security.password_reset_at = timezone.now()
            security.password_reset_by = request.user
            security.failed_login_count = 0
            security.save()
            revoke_sessions(target, by=request.user, reason=f'Password reset: {reason}')
        _audit(request, 'RESET_PASSWORD', target, reason)
        return Response({
            'temporary_password': password,
            'message': 'All of this user\'s sessions were ended. Give them this one-time password in person; '
                       'they must choose a new one at next sign-in.',
        })

    @action(detail=False, methods=['post'], url_path=r'users/(?P<user_id>\d+)/force-logout')
    def force_logout(self, request, user_id=None):
        target = _user_or_404(request, user_id)
        _require_manage(request, target)
        reason = _reason(request)
        ended = revoke_sessions(target, by=request.user, reason=reason)
        _audit(request, 'FORCE_LOGOUT', target, f'{ended} session(s): {reason}')
        return Response({'ended_sessions': ended})

    @action(detail=False, methods=['post'], url_path=r'users/(?P<user_id>\d+)/set-active')
    def set_active(self, request, user_id=None):
        target = _user_or_404(request, user_id)
        _require_manage(request, target)
        reason = _reason(request)
        active = bool(request.data.get('is_active'))
        if active and not target.is_active:
            # Re-enabling must not push a unit past its system-admin limit.
            for a in UserAssignment.objects.filter(user=target, is_active=True).select_related('role', 'org_unit'):
                problem = system_admin_slot_problem(a.role, a.org_unit, exclude_user=target)
                if problem:
                    raise ValidationError({'is_active': [problem]})
        target.is_active = active
        target.save(update_fields=['is_active'])
        if not active:
            revoke_sessions(target, by=request.user, reason=f'Account disabled: {reason}')
            revoke_user_tokens(target)
        _audit(request, 'ENABLE_ACCOUNT' if active else 'DISABLE_ACCOUNT', target, reason)
        return Response({'is_active': active})

    @action(detail=False, methods=['post'], url_path=r'users/(?P<user_id>\d+)/update-profile')
    def update_profile(self, request, user_id=None):
        target = _user_or_404(request, user_id)
        _require_manage(request, target)
        for field in ('first_name', 'last_name', 'email'):
            if field in request.data:
                setattr(target, field, (request.data.get(field) or '').strip())
        if target.email:
            from django.core.validators import validate_email
            try:
                validate_email(target.email)
            except DjangoValidationError:
                raise ValidationError({'email': ['Enter a valid email address.']})
        target.save(update_fields=['first_name', 'last_name', 'email'])
        _audit(request, 'UPDATE_ACCOUNT', target, 'Name/email updated')
        return Response({'ok': True})

    # ---- unit officers and system admins ---------------------------------

    @action(detail=False, methods=['get'], url_path=r'units/(?P<unit_id>\d+)/officers')
    def unit_officers(self, request, unit_id=None):
        """Accounts assigned directly at one province or station, and its system-admin slots."""
        unit = _unit_for_admin(request, unit_id)
        users = (User.objects.filter(org_assignments__org_unit=unit, org_assignments__is_active=True).distinct()
                 .prefetch_related('org_assignments__role', 'org_assignments__org_unit',
                                   'org_assignments__department', 'sessions')
                 .select_related('security'))
        role = _admin_role_for(unit)
        online_ids = _online_user_ids()
        officers = []
        for u in users:
            row = _user_row(u, online_ids)
            here = [a for a in u.org_assignments.all() if a.is_active and a.org_unit_id == unit.pk]
            row['roles_here'] = [{'role_code': a.role.code, 'role_name': a.role.name,
                                  'department_name': a.department.name} for a in here]
            row['is_system_admin'] = role is not None and any(a.role_id == role.pk for a in here)
            officers.append(row)
        officers.sort(key=lambda r: (not r['is_system_admin'], r['username']))

        admins = None
        if role is not None:
            used, limit = system_admin_slots(role, unit)
            problem = _system_admin_problem(request.user, role, unit)
            admins = {'role_code': role.code, 'role_name': role.name, 'used': used, 'limit': limit,
                      'can_create': problem is None, 'reason': problem}
        return Response({
            'unit': {'id': unit.pk, 'code': unit.code, 'name': unit.name, 'unit_type': unit.unit_type,
                     'active': unit.active, 'parent_id': unit.parent_id,
                     'parent_name': unit.parent.name if unit.parent_id else None},
            'officers': officers,
            'system_admins': admins,
        })

    @action(detail=False, methods=['post'], url_path='system-admins')
    def create_system_admin(self, request):
        """Create a provincial (at a province) or station (at a station) system admin.

        The service number is the username. The password is the one the creating
        admin types; the new admin must replace it at first sign-in.
        """
        data = request.data
        unit = _unit_for_admin(request, data.get('org_unit'), active_only=True)
        role = _admin_role_for(unit)
        if role is None:
            raise ValidationError({'org_unit': ['System admins are created at a province or a station.']})
        if not (request.user.is_superuser or can(request.user, 'users.create', unit)):
            raise PermissionDenied('You cannot create accounts here.')
        problem = can_grant(request.user, role, unit)
        if problem:
            raise PermissionDenied(problem)
        problem = system_admin_slot_problem(role, unit)
        if problem:
            raise ValidationError({'org_unit': [problem]})

        username = normalize_service_number(data.get('service_number'))
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError({'service_number': ['An account with this service number already exists.']})
        hr_first, hr_last = _officer_names(username)
        first = (data.get('first_name') or '').strip() or hr_first
        last = (data.get('last_name') or '').strip() or hr_last
        password = data.get('password') or ''
        user = User(username=username, first_name=first, last_name=last)
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            raise ValidationError({'password': list(exc.messages)})
        department = role.department or Department.objects.filter(code='IT').first()
        if department is None:
            raise ValidationError({'org_unit': ['The IT department is missing; set up departments first.']})

        with transaction.atomic():
            # Lock the unit so two admins cannot fill the last slot at the same time.
            OrgUnit.objects.select_for_update().filter(pk=unit.pk).first()
            problem = system_admin_slot_problem(role, unit)
            if problem:
                raise ValidationError({'org_unit': [problem]})
            user.set_password(password)
            user.save()
            UserSecurity.objects.create(user=user, must_change_password=True, password_reset_at=timezone.now(),
                                        password_reset_by=request.user)
            UserAssignment.objects.create(user=user, role=role, org_unit=unit, department=department,
                                          is_primary=True, created_by=get_primary_assignment(request.user))
        _audit(request, 'CREATE_SYSTEM_ADMIN', user, f'{username} as {role.code} at {unit.code}')
        used, limit = system_admin_slots(role, unit)
        return Response({
            'id': user.id, 'username': user.username, 'role_code': role.code, 'org_unit_id': unit.pk,
            'used': used, 'limit': limit,
            'message': f'{username} can sign in with the password you set and must change it at first sign-in.',
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='grantable-roles')
    def grantable(self, request):
        unit = OrgUnit.objects.filter(pk=request.query_params.get('org_unit')).first()
        if unit is None:
            raise ValidationError({'org_unit': ['Choose a unit.']})
        return Response([
            {'id': r.id, 'code': r.code, 'name': r.name, 'department_id': r.department_id,
             'department_name': r.department.name if r.department_id else None, 'is_admin_role': r.is_admin_role}
            for r in grantable_roles(request.user, unit)
        ])

    # ---- sessions & activity --------------------------------------------

    @action(detail=False, methods=['get'])
    def online(self, request):
        scope = _org_filter(request)
        qs = online_sessions().select_related('user', 'org_unit').order_by('-last_seen_at')
        if scope is not None:
            qs = qs.filter(Q(org_unit_id__in=scope) | Q(user__in=_users_in(scope)))
        now = timezone.now()
        return Response([_session_row(s, now) for s in qs.distinct()[:500]])

    @action(detail=False, methods=['post'], url_path=r'sessions/(?P<session_id>[0-9a-f-]+)/end')
    def end_session(self, request, session_id=None):
        session = UserSession.objects.select_related('user').filter(pk=session_id).first()
        if session is None:
            raise NotFound('Session not found.')
        _user_or_404(request, session.user_id)
        _require_manage(request, session.user)
        reason = _reason(request)
        UserSession.objects.filter(pk=session.pk, revoked_at__isnull=True).update(
            revoked_at=timezone.now(), revoked_by=request.user, revoke_reason=reason[:255])
        _audit(request, 'END_SESSION', session.user, reason)
        return Response({'ended': True})

    @action(detail=False, methods=['get'])
    def activity(self, request):
        qs = visible_audit_logs(request.user, AuditLog.objects.select_related('user')).order_by('-timestamp')
        if request.query_params.get('org_unit'):
            qs = qs.filter(user__in=_users_in(_org_filter(request)))
        if request.query_params.get('user'):
            qs = qs.filter(user_id=request.query_params['user'])
        if request.query_params.get('module'):
            qs = qs.filter(module=request.query_params['module'])
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(action__icontains=q) | Q(user__username__icontains=q) | Q(request_path__icontains=q)
                           | Q(remarks__icontains=q))
        since = request.query_params.get('since')
        if since in ('1h', '24h', '7d', '30d'):
            delta = {'1h': timedelta(hours=1), '24h': timedelta(hours=24), '7d': timedelta(days=7),
                     '30d': timedelta(days=30)}[since]
            qs = qs.filter(timestamp__gte=timezone.now() - delta)
        paginator = ConsolePage()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([_audit_row(a) for a in page])

    @action(detail=False, methods=['get'])
    def logins(self, request):
        qs = LoginEvent.objects.select_related('user').order_by('-at')
        scope = _org_filter(request)
        if scope is not None:
            qs = qs.filter(user__in=_users_in(scope))
        if request.query_params.get('failed') == '1':
            qs = qs.filter(success=False)
        paginator = ConsolePage()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([
            {'id': e.id, 'at': e.at, 'username': e.username_attempted, 'user_id': e.user_id,
             'success': e.success, 'reason': e.reason, 'ip_address': e.ip_address, 'user_agent': e.user_agent}
            for e in page
        ])

    # ---- storage --------------------------------------------------------

    @action(detail=False, methods=['get', 'post'])
    def storage(self, request):
        if request.method == 'POST':
            if not is_national_admin(request.user):
                raise PermissionDenied('Only HQ can refresh storage figures.')
            compute_org_usage()

        rows, captured = latest_snapshot()
        scope = _scope(request)
        units = {u.id: u for u in _units_in_scope(request)}
        usage, unassigned, shared = _usage_by_unit(rows)

        by_module = defaultdict(lambda: {'bytes': 0, 'rows': 0})
        for r in rows.filter(**({} if scope is None else {'org_unit_id__in': scope})).values('module') \
                .annotate(b=Sum('est_bytes'), n=Sum('row_count')):
            by_module[r['module']] = {'bytes': r['b'] or 0, 'rows': r['n'] or 0}

        def unit_row(u):
            own = usage[u.id]
            return {'id': u.id, 'code': u.code, 'name': u.name, 'unit_type': u.unit_type, 'parent_id': u.parent_id,
                    'bytes': own['bytes'], 'rows': own['rows']}

        unit_rows = [unit_row(u) for u in units.values()]
        # Provinces also report the total including their stations.
        for row in unit_rows:
            if row['unit_type'] == 'PROVINCIAL_HQ':
                kids = [r for r in unit_rows if r['parent_id'] == row['id']]
                row['total_bytes'] = row['bytes'] + sum(k['bytes'] for k in kids)
                row['total_rows'] = row['rows'] + sum(k['rows'] for k in kids)

        return Response({
            'captured_at': captured,
            'database_bytes': database_size() if scope is None else None,
            'units': sorted(unit_rows, key=lambda r: -r.get('total_bytes', r['bytes'])),
            'unassigned': unassigned if scope is None else None,
            'shared': shared if scope is None else None,
            'by_module': [{'module': m, **v} for m, v in sorted(by_module.items(), key=lambda kv: -kv[1]['bytes'])],
            'note': 'Estimates: rows x average row size per table, including indexes. Refreshed nightly.',
        })
