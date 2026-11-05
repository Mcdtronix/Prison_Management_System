from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'Messaging'
    verbose_name = 'Messaging / Inbox (Phase 3)'

    def ready(self):
        from . import signals  # noqa: F401  (creates a mailbox for every department)
