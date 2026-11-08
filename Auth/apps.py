from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'Auth'
    def ready(self):
        # Sign-in recording feeds the login throttle: a security control, so
        # it is imported outside the try below and fails loudly if broken.
        import Auth.signals_login  # noqa: F401

        # Import signals to ensure they are connected
        try:
            import Auth.signals  # noqa: F401
        except Exception:
            pass
