"""Test helpers for the built-in roles and departments.

The data migration creates the built-in roles and departments in every test
database, so tests fetch them instead of creating duplicates.
"""
from .models import Department, Role, UserAssignment


def role(code, name=None):
    """A role by code: the built-in one if it exists, otherwise a new custom role."""
    return Role.objects.get_or_create(code=code, defaults={'name': name or code.replace('_', ' ').title()})[0]


def department(code, name=None):
    """A department by code, created if it is not built in."""
    return Department.objects.get_or_create(code=code, defaults={'name': name or code.title()})[0]


def assign(user, role_obj, org_unit, primary=True, dept=None, **extra):
    """Give `user` `role_obj` at `org_unit`, in the role's own department by default."""
    dept = dept or role_obj.department or department('ADMINISTRATION')
    return UserAssignment.objects.create(user=user, role=role_obj, org_unit=org_unit, department=dept,
                                         is_primary=primary, **extra)
