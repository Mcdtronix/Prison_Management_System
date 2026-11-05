"""Create the missing mailbox for every existing department at an org unit."""
from django.db import migrations


def backfill(apps, schema_editor):
    OrgUnitDepartment = apps.get_model('Auth', 'OrgUnitDepartment')
    Mailbox = apps.get_model('Messaging', 'Mailbox')
    taken = set(Mailbox.objects.values_list('mailbox_address', flat=True))
    for oud in OrgUnitDepartment.objects.filter(mailbox__isnull=True):
        if oud.mailbox_address in taken:  # address already used by another mailbox; leave it
            continue
        Mailbox.objects.create(org_unit_department=oud, mailbox_address=oud.mailbox_address)
        taken.add(oud.mailbox_address)


class Migration(migrations.Migration):

    dependencies = [
        ('Messaging', '0002_message_folder_draft'),
        ('Auth', '0009_org_unit_admin_proxies'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
