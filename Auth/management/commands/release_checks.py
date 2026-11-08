"""Pre-switch checks for a candidate release, run by scripts/deploy/deploy.sh.

These used to be HTTP probes of /admin/login/ and /swagger.json. Both pages
are off in production now (audit M3), so the same guarantees are checked
in-process instead:

* the API schema builds: every endpoint imports and every serializer
  instantiates (a broken view or serializer fails here, before users see it);
* the static-files manifest resolves (a missing collectstatic entry would
  otherwise turn pages into 500s).

Prints the back-office settings so the deploy log shows what is exposed.
Exit status is non-zero on any failure.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Checks a release before it receives traffic: API schema and static manifest.'

    def handle(self, *args, **options):
        self._api_schema()
        self._static_manifest()
        self.stdout.write(
            f'admin_enabled={settings.ADMIN_ENABLED} api_docs_enabled={settings.API_DOCS_ENABLED} '
            f'admin_allowed_ips={",".join(settings.ADMIN_ALLOWED_IPS) or "any"}'
        )

    def _api_schema(self):
        from drf_yasg import openapi
        from drf_yasg.generators import OpenAPISchemaGenerator

        try:
            generator = OpenAPISchemaGenerator(openapi.Info(title='PMS', default_version='v1'))
            schema = generator.get_schema(request=None, public=True)
        except Exception as exc:  # any import, view or serializer error
            raise CommandError(f'API schema failed to build: {exc!r}') from exc
        paths = len(schema.get('paths', {}))
        if paths == 0:
            raise CommandError('API schema built but lists no endpoints')
        self.stdout.write(f'API schema builds ({paths} paths)')

    def _static_manifest(self):
        from django.templatetags.static import static

        # An asset every release ships (the Django admin's stylesheet, collected
        # whether or not the admin is switched on).
        try:
            url = static('admin/css/base.css')
        except Exception as exc:
            raise CommandError(f'Static manifest is missing or incomplete: {exc!r}') from exc
        self.stdout.write(f'Static manifest resolves ({url})')
