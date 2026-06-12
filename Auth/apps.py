from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'Auth'
    def ready(self):
        # Import signals to ensure they are connected
        try:
            import Auth.signals  # noqa: F401
        except Exception:
            pass
