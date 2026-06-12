from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from .models import AuditLog
from .middleware import get_current_request

User = get_user_model()


@receiver(pre_save, sender=User)
def detect_password_change(sender, instance, **kwargs):
    """Detect password changes and attach a flag on the instance for post_save to record."""
    if not instance.pk:
        # New user creation handled in post_save
        instance._password_changed = False
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._password_changed = False
        return

    instance._password_changed = old.password != instance.password


@receiver(post_save, sender=User)
def record_user_events(sender, instance, created, **kwargs):
    req = get_current_request()
    ip = None
    ua = None
    path = None
    method = None
    actor = None
    role = ''
    station = None

    if req is not None:
        ip = req.META.get('REMOTE_ADDR') or req.META.get('HTTP_X_FORWARDED_FOR')
        ua = req.META.get('HTTP_USER_AGENT', '')
        path = req.path
        method = req.method
        actor = getattr(req, 'user', None)

    # For creation
    if created:
        AuditLog.objects.create(
            user=actor or instance,
            role=getattr(actor, 'username', 'system') if actor else 'system',
            station=getattr(actor, 'userprofile', None).station if actor and hasattr(actor, 'userprofile') else getattr(instance, 'userprofile', None).station if hasattr(instance, 'userprofile') else None,
            action='CREATE_USER',
            module='AUTH',
            object_id=str(instance.pk),
            object_type='User',
            ip_address=ip or '0.0.0.0',
            user_agent=ua,
            request_method=method,
            request_path=path,
            remarks=f'User {instance.username} created',
        )

    # For password changes
    if getattr(instance, '_password_changed', False):
        AuditLog.objects.create(
            user=actor or instance,
            role=getattr(actor, 'username', 'system') if actor else 'system',
            station=getattr(actor, 'userprofile', None).station if actor and hasattr(actor, 'userprofile') else getattr(instance, 'userprofile', None).station if hasattr(instance, 'userprofile') else None,
            action='PASSWORD_CHANGE',
            module='AUTH',
            object_id=str(instance.pk),
            object_type='User',
            ip_address=ip or '0.0.0.0',
            user_agent=ua,
            request_method=method,
            request_path=path,
            remarks=f'Password changed for {instance.username}',
        )
