"""The normal URLs with the Django admin always on, whatever ADMIN_ENABLED says.

For tests that exercise the admin: CI runs with DEBUG=False, where the admin
is off by default. Use @override_settings(ROOT_URLCONF='Core.urls_admin_on').
"""
from django.contrib import admin
from django.urls import path

from Core.urls import urlpatterns as _normal

urlpatterns = [path('admin/', admin.site.urls)] + [
    p for p in _normal if not str(p.pattern).startswith('admin/')
]
