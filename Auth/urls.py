"""
Authentication URL Configuration
================================
"""

from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    logout_view,
    current_user_view,
    UserCreationOptionsView,
    UserManagementView,
    PhaseOneSetupView,
)
from .views_audit import AuditLogViewSet
from .views_admin import AdminWorkflowViewSet
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='auditlog')
router.register(r'admin-actions', AdminWorkflowViewSet, basename='admin-actions')

app_name = 'auth'

urlpatterns = [
    # Authentication endpoints
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', logout_view, name='logout'),
    
    # User endpoints
    path('me/', current_user_view, name='current_user'),
    path('users/', UserManagementView.as_view(), name='user_list_create'),
    path('users/create-options/', UserCreationOptionsView.as_view(), name='user_create_options'),
    path('setup/', PhaseOneSetupView.as_view(), name='phase_one_setup'),
    path('', include((router.urls, 'audit'))),
]

