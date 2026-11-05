from django.urls import include, path
from rest_framework import routers

from . import files, views

router = routers.DefaultRouter()
router.register(r'mailboxes', views.MailboxViewSet, basename='mailbox')
router.register(r'threads', views.ThreadViewSet, basename='thread')
router.register(r'messages', views.MessageViewSet, basename='message')
router.register(r'drafts', views.DraftViewSet, basename='draft')

urlpatterns = [
    path('unread_count/', views.unread_count_view, name='unread-count'),
    path('config/', views.config_view, name='messaging-config'),
    path('signature/', views.signature_view, name='messaging-signature'),
    path('inline-images/', views.inline_image_view, name='messaging-inline-image'),
    path('grammar/', views.grammar_view, name='messaging-grammar'),
    path('files/<str:kind>/<str:obj_id>/', files.download, name='messaging-file'),
    path('', include(router.urls)),
]
