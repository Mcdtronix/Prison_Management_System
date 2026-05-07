"""
Authentication URL Configuration
================================
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    logout_view,
    current_user_view,
    UserCreationOptionsView,
    UserManagementView,
)

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
]

