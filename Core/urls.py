"""
URL configuration for Core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

from django.http import JsonResponse
from django.db import connection
from django.views.decorators.http import require_GET

@require_GET
def health_check(request):
    """
    Production health check endpoint.
    Validates database connectivity and basic application state.
    """
    try:
        # Verify database is reachable
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse({
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0",
        }, status=200)

    except Exception as e:
        return JsonResponse({
            "status": "unhealthy",
            "error": str(e),
        }, status=503)

schema_view = get_schema_view(
    openapi.Info(
        title="Prison Management System API",
        default_version='v1',
        description="API documentation for Prison Management System",
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('api/ping/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/auth/', include('Auth.urls')),
    path('api/reception/', include('Reception.urls')),
    path('api/health/', include('Health.urls')),
    path('api/stores/', include('Stores.urls')),
    path('api/farms/', include('Farms.urls')),
    path('api/hr/', include('HumanResources.urls')),
    path('api/cases/', include('Cases.urls')),
    path('api/messaging/', include('Messaging.urls')),

    # Swagger / OpenAPI docs
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
