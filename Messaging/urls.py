from rest_framework import routers
from django.urls import path, include

from .views import MailboxViewSet, ThreadViewSet, MessageViewSet

router = routers.DefaultRouter()
router.register(r'mailboxes', MailboxViewSet)
router.register(r'threads', ThreadViewSet)
router.register(r'messages', MessageViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
