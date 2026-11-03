"""Create the built-in departments and roles, and merge older duplicates into them.

Departments: IT, Administration, Reception, Health, Stores, Security,
Rehabilitation, Farms. Roles: HQ / Provincial / Station System Admin (all in
IT), Administration, Reception, Health, Stores, Farms, Security and
Rehabilitation officers, and a read-only Auditor.

Older rows that mean the same thing (for example a `REC` role or a
`SYS_ADMIN` department) are merged: the first match is renamed to the
built-in code; any others have their users moved across and are then
deleted, or disabled if something else still refers to them. No user,
assignment or record is lost. Re-running this migration changes nothing.
"""
from django.db import migrations, transaction
from django.db.models import ProtectedError


def _retire(row, note, active_field):
    """Delete a merged duplicate; if something still points at it, disable it instead."""
    try:
        with transaction.atomic():
            row.delete()
    except ProtectedError:
        setattr(row, active_field, False)
        row.description = note
        row.save(update_fields=[active_field, 'description'])


def _repoint(apps, model_label, old, new):
    """Move every foreign key that points at `old` over to `new`."""
    Model = apps.get_model('Auth', model_label)
    for rel in Model._meta.related_objects:
        if not (rel.many_to_one or rel.one_to_one):
            continue
        related = rel.related_model
        field = rel.field.name
        if related._meta.label == 'Auth.OrgUnitDepartment':
            # One row per (unit, department): move only where there is no clash.
            for oud in related.objects.filter(**{field: old}):
                if related.objects.filter(org_unit_id=oud.org_unit_id, **{field: new}).exists():
                    oud.active = False
                    oud.save(update_fields=['active'])
                else:
                    setattr(oud, field, new)
                    oud.save(update_fields=[field])
        elif related._meta.label == 'Auth.RoleCapability':
            related.objects.filter(**{field: old}).delete()
        else:
            related.objects.filter(**{field: old}).update(**{field: new})


def seed(apps, schema_editor):
    from Auth.capabilities import (
        ADMIN_ROLE_CODES, BUILTIN_DEPARTMENTS, BUILTIN_ROLES, DEFAULT_ROLE_CAPABILITIES,
        DEPARTMENT_ALIASES, ROLE_ASSIGNABLE_AT,
    )
    from Auth.utils import normalize_role_code

    Department = apps.get_model('Auth', 'Department')
    Role = apps.get_model('Auth', 'Role')
    RoleCapability = apps.get_model('Auth', 'RoleCapability')
    UserAssignment = apps.get_model('Auth', 'UserAssignment')

    # ------------------------------------------------------------ departments
    departments = {}
    for code, name in BUILTIN_DEPARTMENTS.items():
        aliases = [a for a, target in DEPARTMENT_ALIASES.items() if target == code]
        dept = (Department.objects.filter(code=code).first()
                or Department.objects.filter(name__iexact=name).first()
                or Department.objects.filter(code__in=aliases).order_by('id').first())
        if dept is None:
            dept = Department.objects.create(code=code, name=name)
        if dept.code != code or not dept.is_system or not dept.active:
            if dept.code != code and not Department.objects.filter(name=name).exclude(pk=dept.pk).exists():
                dept.name = name
            dept.code = code
            dept.is_system = True
            dept.active = True
            dept.save()
        for alias in Department.objects.filter(code__in=aliases).exclude(pk=dept.pk):
            _repoint(apps, 'Department', alias, dept)
            _retire(alias, f'Merged into {code}.', 'active')
        departments[code] = dept

    # ------------------------------------------------------------ roles
    for code, (name, dept_code, is_admin, level) in BUILTIN_ROLES.items():
        matches = sorted(
            (r for r in Role.objects.all() if normalize_role_code(r.code) == code),
            key=lambda r: (r.code != code, -UserAssignment.objects.filter(role=r).count(), r.id),
        )
        if matches:
            role, extras = matches[0], matches[1:]
        else:
            role, extras = Role.objects.create(code=code, name=name), []
        role.code = code
        role.name = name
        role.is_system = True
        role.is_active = True
        role.is_admin_role = is_admin
        role.assignable_at = level
        role.department = departments.get(dept_code) if dept_code else None
        role.save()
        for extra in extras:
            _repoint(apps, 'Role', extra, role)
            _retire(extra, f'Merged into {code}.', 'is_active')

    # ------------------------------------------------------------ capabilities
    for role in Role.objects.all():
        code = normalize_role_code(role.code)
        if code in ADMIN_ROLE_CODES and not role.is_admin_role:
            role.is_admin_role = True
            role.assignable_at = role.assignable_at or ROLE_ASSIGNABLE_AT.get(code)
            role.save(update_fields=['is_admin_role', 'assignable_at'])
        if role.is_active and not RoleCapability.objects.filter(role=role).exists():
            RoleCapability.objects.bulk_create(
                [RoleCapability(role=role, capability=c) for c in DEFAULT_ROLE_CAPABILITIES.get(code, [])],
                ignore_conflicts=True,
            )

    # ------------------------------------------------------------ assignments
    # Each assignment moves to its role's home department (system admins -> IT).
    for role in Role.objects.exclude(department__isnull=True):
        UserAssignment.objects.filter(role=role).exclude(department=role.department).update(department=role.department)


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0006_builtin_roles_departments_capabilities'),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
