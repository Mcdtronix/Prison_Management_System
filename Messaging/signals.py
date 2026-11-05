"""Every department at an org unit gets its mailbox as soon as it exists.

Without this, a mailbox record only appeared once someone from that
department signed in or was written to, so the recipient search in Compose
could not find most departments.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from Auth.models import OrgUnitDepartment

from .models import Mailbox


@receiver(post_save, sender=OrgUnitDepartment)
def ensure_mailbox(sender, instance, raw=False, **kwargs):
    if raw:  # loading fixtures
        return
    mailbox, created = Mailbox.objects.get_or_create(
        org_unit_department=instance, defaults={'mailbox_address': instance.mailbox_address})
    if not created and mailbox.mailbox_address != instance.mailbox_address:
        mailbox.mailbox_address = instance.mailbox_address
        mailbox.save(update_fields=['mailbox_address'])
