from django.urls import path, include
from rest_framework import routers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .views import MailboxViewSet, ThreadViewSet, MessageViewSet

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count_view(request):
    mailbox = getattr(request, 'mailbox', None)
    if not mailbox:
        return Response({'count': 0})
    
    from .models import ThreadParticipant, Message
    # Count messages in threads where the user is a participant, and the message created_at > last_read_at
    # Or just return 0 for now as a quick fix if the query is complex
    # A correct implementation:
    participants = ThreadParticipant.objects.filter(mailbox=mailbox)
    count = 0
    for p in participants:
        # messages in thread not read by mailbox
        unread = p.thread.messages.exclude(read_by=mailbox).count()
        count += unread
    return Response({'count': count})

from .views import MailboxViewSet, ThreadViewSet, MessageViewSet

router = routers.DefaultRouter()
router.register(r'mailboxes', MailboxViewSet)
router.register(r'threads', ThreadViewSet)
router.register(r'messages', MessageViewSet)

urlpatterns = [
    path('unread_count/', unread_count_view, name='unread-count'),
    path('', include(router.urls)),
]
