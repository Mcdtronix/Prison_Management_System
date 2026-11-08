"""Administration officers keep officer service records.

HR endpoints used to accept any signed-in user. They now need an `hr.*`
capability, so the Administration Officer role, which runs the Officer
Details page, is given `hr.create` and `hr.change`. It already reads them
through `users.view`; `hr.view` is left out because it also opens the
Officers report source, which Administration officers do not get.
"""
from django.db import migrations

ROLE = 'ADMIN_OFFICER'
CAPABILITIES = ['hr.create', 'hr.change']


def grant(apps, schema_editor):
    Role = apps.get_model('Auth', 'Role')
    RoleCapability = apps.get_model('Auth', 'RoleCapability')
    for role in Role.objects.filter(code=ROLE):
        for capability in CAPABILITIES:
            RoleCapability.objects.get_or_create(role=role, capability=capability)


def revoke(apps, schema_editor):
    RoleCapability = apps.get_model('Auth', 'RoleCapability')
    RoleCapability.objects.filter(role__code=ROLE, capability__in=CAPABILITIES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0009_org_unit_admin_proxies'),
    ]

    operations = [
        migrations.RunPython(grant, revoke),
    ]
