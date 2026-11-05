"""Messaging API, mounted at /api/messaging/.

Access rules (every endpoint follows them):

* A user acts through one mailbox: their primary assignment's department at
  their org unit (`request.mailbox`, set by MailboxContextMiddleware).
* You only ever see conversations your mailbox takes part in.
* Any mailbox may start a conversation with any other active mailbox.
  Unknown or inactive addresses are refused; nothing is created from a
  typed address.
* Messages cannot be edited or deleted. "Delete" moves a conversation to
  your own trash; other participants are unaffected.
* Files are only reachable through short-lived signed links (files.py).

Endpoints:
    GET  threads/?folder=inbox|sent|starred|archived|trash&q=   your conversations
    POST threads/                                    start a conversation
    GET  threads/<id>/                               open one (marks it read)
    POST threads/<id>/state/   threads/state/        star, archive, trash, read/unread
    GET  messages/   POST messages/                  your messages / reply
    GET  mailboxes/?q=                               recipient directory
    *    drafts/                                     your unsent messages
    GET|PUT signature/                               your signature
    POST inline-images/                              picture for a message body
    GET  config/                                     limits and features
    POST grammar/                                    grammar check (if configured)
    GET  unread_count/
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.db.models import Count, DateTimeField, Exists, F, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, Substr
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Auth.models import OrgUnitDepartment

from . import richtext
from .files import check_attachments, check_inline_image, save_attachments, signed_url
from .models import Attachment, Draft, InlineImage, Mailbox, Message, Signature, Thread, ThreadParticipant
from .permissions import MessagingPermission
from .serializers import (DraftSerializer, MailboxSerializer, MessageSerializer, ReplySerializer,
                          SignatureSerializer, ThreadDetailSerializer, ThreadStateSerializer,
                          ThreadSummarySerializer, mailbox_brief)

logger = logging.getLogger(__name__)

READ_AND_CREATE = ['get', 'post', 'head', 'options']
FOLDERS = ('inbox', 'sent', 'starred', 'archived', 'trash')
EPOCH = datetime(1970, 1, 1, tzinfo=dt_timezone.utc)
MAILBOX_RELATED = ('org_unit_department__org_unit', 'org_unit_department__department')


# ------------------------------------------------------------------ helpers

def _own_mailbox(request):
    """The caller's mailbox, or 403 if their account has none."""
    mailbox = getattr(request, 'mailbox', None)
    if mailbox is None:
        raise PermissionDenied('Your account has no mailbox. Ask an administrator to assign you a department.')
    return mailbox


def _uploaded(request):
    return request.FILES.getlist('attachments') if hasattr(request.FILES, 'getlist') else []


def _addresses(data):
    """Recipient addresses from a list field or comma-separated strings, de-duplicated."""
    raw = data.getlist('participants') if hasattr(data, 'getlist') else data.get('participants') or []
    if isinstance(raw, str):
        raw = [raw]
    seen, out = set(), []
    for item in raw:
        for addr in str(item).split(','):
            addr = addr.strip()
            if addr and addr.lower() not in seen:
                seen.add(addr.lower())
                out.append(addr)
    return out


def _resolve_recipient(address):
    """An existing, active mailbox for `address`. Never creates departments."""
    mailbox = (Mailbox.objects.select_related('org_unit_department__org_unit')
               .filter(mailbox_address__iexact=address).first())
    if mailbox is None:
        oud = OrgUnitDepartment.objects.filter(mailbox_address__iexact=address).first()
        if oud is None:
            raise ValidationError({'participants': f'Unknown mailbox: {address}'})
        mailbox, _ = Mailbox.objects.get_or_create(
            org_unit_department=oud, defaults={'mailbox_address': oud.mailbox_address})
    oud = mailbox.org_unit_department
    if not oud.active or not oud.org_unit.active:
        raise ValidationError({'participants': f'Mailbox is not active: {mailbox.mailbox_address}'})
    return mailbox


def _message_body(data, html_key='body_html', text_key='body'):
    """(plain text, cleaned HTML) from a request. Formatted input wins over plain."""
    raw_html = data.get(html_key) or ''
    if raw_html.strip():
        try:
            cleaned = richtext.clean_html(raw_html)
        except ValueError as exc:
            raise ValidationError({html_key: str(exc)})
        return richtext.html_to_text(cleaned), cleaned
    return (data.get(text_key) or '').strip(), ''


def _has_content(text, cleaned, files):
    return bool(text.strip() or files or '<img' in cleaned)


def _add_message(request, thread, sender, text, cleaned, importance, files):
    """Store a message, its files and pictures, and update everyone's view of the thread."""
    message = Message.objects.create(thread=thread, sender=sender, sent_by=request.user, body=text,
                                     body_html=cleaned, importance=importance)
    save_attachments(message, files)
    image_ids = richtext.inline_image_ids(cleaned)
    if image_ids:
        InlineImage.objects.filter(id__in=image_ids, uploaded_by=request.user, message__isnull=True).update(message=message)
    Thread.objects.filter(pk=thread.pk).update(last_message_at=message.created_at)
    # New activity brings the conversation back to everyone's inbox; the sender has read it.
    ThreadParticipant.objects.filter(thread=thread).update(archived_at=None, trashed_at=None)
    ThreadParticipant.objects.filter(thread=thread, mailbox=sender).update(last_read_at=message.created_at)
    return message


def _importance(data):
    value = (data.get('importance') or 'NORMAL').upper()
    if value not in {c for c, _ in Message.IMPORTANCE}:
        raise ValidationError({'importance': 'Use LOW, NORMAL or HIGH.'})
    return value


class FolderPage(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


# ------------------------------------------------------------------ directory

class MailboxViewSet(viewsets.ReadOnlyModelViewSet):
    """Recipient directory: every active mailbox. ?q= matches address, unit or department."""
    serializer_class = MailboxSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = []

    def get_queryset(self):
        qs = Mailbox.objects.select_related(*MAILBOX_RELATED).filter(
            org_unit_department__active=True, org_unit_department__org_unit__active=True)
        for word in (self.request.query_params.get('q') or '').split():
            qs = qs.filter(
                Q(mailbox_address__icontains=word) |
                Q(org_unit_department__org_unit__name__icontains=word) |
                Q(org_unit_department__org_unit__code__icontains=word) |
                Q(org_unit_department__department__name__icontains=word) |
                Q(org_unit_department__department__code__icontains=word)
            )
        return qs.order_by('org_unit_department__org_unit__name', 'org_unit_department__department__name')


# ------------------------------------------------------------------ conversations

class ThreadViewSet(viewsets.GenericViewSet):
    """Your conversations, seen through your own mailbox's state."""
    permission_classes = (IsAuthenticated, MessagingPermission)
    filter_backends = []  # access is by participation, not by org area
    pagination_class = FolderPage

    def _mine(self):
        """The caller's participant rows (one per conversation)."""
        mailbox = getattr(self.request, 'mailbox', None)
        if mailbox is None:
            return ThreadParticipant.objects.none()
        return ThreadParticipant.objects.filter(mailbox=mailbox).select_related('thread')

    def _participant(self, pk):
        return get_object_or_404(self._mine(), thread_id=pk)

    def list(self, request):
        mailbox = getattr(request, 'mailbox', None)
        folder = request.query_params.get('folder') or 'inbox'
        if folder not in FOLDERS:
            raise ValidationError({'folder': f'Use one of {", ".join(FOLDERS)}.'})
        qs = self._mine()
        if mailbox is None:
            self.paginate_queryset(qs)
            return self.get_paginated_response([])

        messages = Message.objects.filter(thread=OuterRef('thread_id'))
        from_others = messages.exclude(sender=mailbox)
        qs = qs.annotate(_read_until=Coalesce('last_read_at', Value(EPOCH, output_field=DateTimeField())))
        qs = qs.annotate(
            unread_count=Coalesce(Subquery(
                from_others.filter(created_at__gt=OuterRef('_read_until')).order_by()
                .values('thread').annotate(n=Count('id')).values('n')[:1], output_field=IntegerField()), 0),
            message_count=Coalesce(Subquery(
                messages.order_by().values('thread').annotate(n=Count('id')).values('n')[:1],
                output_field=IntegerField()), 0),
            snippet=Coalesce(Substr(Subquery(messages.order_by('-created_at').values('body')[:1]), 1, 160), Value('')),
            last_sender_id=Subquery(messages.order_by('-created_at').values('sender')[:1]),
            important=Exists(messages.filter(importance='HIGH')),
            has_attachments=Exists(Attachment.objects.filter(message__thread=OuterRef('thread_id'))),
            has_incoming=Exists(from_others),
            has_outgoing=Exists(messages.filter(sender=mailbox)),
        )

        if folder == 'trash':
            qs = qs.filter(trashed_at__isnull=False)
        else:
            qs = qs.filter(trashed_at__isnull=True)
            if folder == 'inbox':
                qs = qs.filter(archived_at__isnull=True, has_incoming=True)
            elif folder == 'sent':
                qs = qs.filter(has_outgoing=True)
            elif folder == 'starred':
                qs = qs.filter(starred=True)
            elif folder == 'archived':
                qs = qs.filter(archived_at__isnull=False)

        for word in (request.query_params.get('q') or '').split()[:8]:
            qs = qs.filter(Q(thread__subject__icontains=word) | Exists(messages.filter(body__icontains=word)))

        qs = qs.order_by(F('thread__last_message_at').desc(nulls_last=True), '-thread_id').prefetch_related(
            *(f'thread__participants__mailbox__{rel}' for rel in MAILBOX_RELATED))
        page = self.paginate_queryset(qs)
        sender_ids = {row.last_sender_id for row in page if row.last_sender_id}
        mailboxes = Mailbox.objects.select_related(*MAILBOX_RELATED).in_bulk(sender_ids)
        data = ThreadSummarySerializer(page, many=True, context={'request': request, 'mailboxes': mailboxes}).data
        return self.get_paginated_response(data)

    def retrieve(self, request, pk=None):
        """Open a conversation. Marks it read unless ?mark_read=0."""
        participant = self._participant(pk)
        if request.query_params.get('mark_read') != '0':
            participant.last_read_at = timezone.now()
            participant.save(update_fields=['last_read_at'])
        participant = (self._mine().filter(pk=participant.pk).prefetch_related(
            *(f'thread__participants__mailbox__{rel}' for rel in MAILBOX_RELATED),
            *(f'thread__messages__sender__{rel}' for rel in MAILBOX_RELATED),
            'thread__messages__sent_by', 'thread__messages__attachments').get())
        return Response(ThreadDetailSerializer(participant, context={'request': request}).data)

    @transaction.atomic
    def create(self, request):
        """Start a conversation.

        Fields: subject, participants (addresses, list or comma-separated),
        body_html (formatted) or initial_body (plain), importance,
        files under `attachments`, optional draft_id to remove once sent.
        """
        sender = _own_mailbox(request)
        data = request.data
        subject = (data.get('subject') or '').strip()
        if not subject:
            raise ValidationError({'subject': 'Enter a subject.'})
        if len(subject) > 255:
            raise ValidationError({'subject': 'Keep the subject under 255 characters.'})

        addresses = [a for a in _addresses(data) if a.lower() != sender.mailbox_address.lower()]
        if not addresses:
            raise ValidationError({'participants': 'Add at least one recipient.'})
        if len(addresses) > settings.MAX_THREAD_RECIPIENTS:
            raise ValidationError({'participants': f'At most {settings.MAX_THREAD_RECIPIENTS} recipients.'})
        recipients = [_resolve_recipient(a) for a in addresses]

        text, cleaned = _message_body(data, 'body_html', 'initial_body')
        files = check_attachments(_uploaded(request))
        importance = _importance(data)

        thread = Thread.objects.create(subject=subject, created_by=request.user,
                                       owner_org_unit=getattr(request, 'org_unit', None))
        ThreadParticipant.objects.create(thread=thread, mailbox=sender)
        for mailbox in recipients:
            ThreadParticipant.objects.get_or_create(thread=thread, mailbox=mailbox)
        message = None
        if _has_content(text, cleaned, files):
            message = _add_message(request, thread, sender, text, cleaned, importance, files)
        else:
            Thread.objects.filter(pk=thread.pk).update(last_message_at=thread.created_at)

        draft_id = data.get('draft_id')
        if draft_id and str(draft_id).isdigit():
            Draft.objects.filter(pk=int(draft_id), mailbox=sender).delete()

        participant = self._mine().get(thread=thread)
        output = dict(ThreadDetailSerializer(participant, context={'request': request}).data)
        if message is not None:
            output['initial_message'] = MessageSerializer(message, context={'request': request}).data
        return Response(output, status=status.HTTP_201_CREATED)

    def _apply_state(self, rows, changes):
        now = timezone.now()
        update = {}
        if 'starred' in changes:
            update['starred'] = changes['starred']
        if 'archived' in changes:
            update['archived_at'] = now if changes['archived'] else None
        if 'trashed' in changes:
            update['trashed_at'] = now if changes['trashed'] else None
        if 'read' in changes:
            update['last_read_at'] = now if changes['read'] else None
        return rows.update(**update)

    @action(detail=True, methods=['post'])
    def state(self, request, pk=None):
        """Star, archive, trash or mark read/unread one conversation, for your mailbox only."""
        participant = self._participant(pk)
        serializer = ThreadStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self._apply_state(self._mine().filter(pk=participant.pk), serializer.validated_data)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='state')
    def bulk_state(self, request):
        """The same for several conversations: {"ids": [...], "archived": true}."""
        _own_mailbox(request)
        serializer = ThreadStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data.get('ids') or []
        if not ids:
            raise ValidationError({'ids': 'Choose at least one conversation.'})
        changed = self._apply_state(self._mine().filter(thread_id__in=ids), serializer.validated_data)
        return Response({'status': 'ok', 'updated': changed})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        self._mine().filter(pk=self._participant(pk).pk).update(last_read_at=timezone.now())
        return Response({'status': 'ok'})


class MessageViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Messages in your conversations. Read and reply only."""
    serializer_class = MessageSerializer
    permission_classes = (IsAuthenticated, MessagingPermission)
    filter_backends = []  # access is by participation, not by org area

    def get_queryset(self):
        mailbox = getattr(self.request, 'mailbox', None)
        if mailbox is None:
            return Message.objects.none()
        return (Message.objects.filter(thread__participants__mailbox=mailbox)
                .select_related('sent_by', *(f'sender__{rel}' for rel in MAILBOX_RELATED))
                .prefetch_related('attachments').distinct().order_by('created_at'))

    @transaction.atomic
    def create(self, request):
        """Reply in a conversation you are part of."""
        sender = _own_mailbox(request)
        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = ThreadParticipant.objects.filter(thread_id=serializer.validated_data['thread'],
                                                       mailbox=sender).select_related('thread').first()
        if participant is None:
            raise PermissionDenied('You are not part of this conversation.')
        text, cleaned = _message_body(request.data)
        files = check_attachments(_uploaded(request))
        if not _has_content(text, cleaned, files):
            raise ValidationError({'body': 'Write a message or attach a file.'})
        message = _add_message(request, participant.thread, sender, text, cleaned,
                               serializer.validated_data['importance'], files)
        return Response(MessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------ drafts, signature, pictures

class DraftViewSet(viewsets.ModelViewSet):
    """Your mailbox's unsent messages."""
    serializer_class = DraftSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = []
    pagination_class = FolderPage

    def get_queryset(self):
        mailbox = getattr(self.request, 'mailbox', None)
        return Draft.objects.filter(mailbox=mailbox) if mailbox else Draft.objects.none()

    def perform_create(self, serializer):
        serializer.save(mailbox=_own_mailbox(self.request), created_by=self.request.user)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def signature_view(request):
    """Your signature, added to new messages and replies when auto_insert is on."""
    signature = Signature.objects.filter(user=request.user).first()
    if request.method == 'GET':
        if signature is None:
            return Response({'body_html': '', 'auto_insert': True, 'updated_at': None})
        return Response(SignatureSerializer(signature, context={'request': request}).data)
    serializer = SignatureSerializer(signature, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def inline_image_view(request):
    """Upload a picture to place inside a message body. Returns its id and a display link."""
    _own_mailbox(request)
    upload = request.FILES.get('file')
    if upload is None:
        raise ValidationError({'file': 'Choose a picture.'})
    content_type = check_inline_image(upload)
    image = InlineImage.objects.create(file=upload, content_type=content_type, size=upload.size,
                                       uploaded_by=request.user)
    return Response({'id': str(image.id), 'url': signed_url(request, 'inline', image.id)},
                    status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def config_view(request):
    """Limits and optional features, so the screens can explain them up front."""
    return Response({
        'mailbox': mailbox_brief(getattr(request, 'mailbox', None)),
        'max_attachments': settings.MESSAGING_MAX_ATTACHMENTS,
        'max_attachment_bytes': settings.MESSAGING_MAX_ATTACHMENT_BYTES,
        'max_inline_image_bytes': settings.MESSAGING_MAX_INLINE_IMAGE_BYTES,
        'allowed_extensions': sorted(e.lower() for e in settings.ALLOWED_UPLOAD_EXTENSIONS),
        'grammar_enabled': bool(settings.LANGUAGETOOL_URL),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count_view(request):
    """Unread messages from others in conversations that are not in your trash."""
    mailbox = getattr(request, 'mailbox', None)
    if mailbox is None:
        return Response({'count': 0})
    unread_for_me = ThreadParticipant.objects.filter(
        thread=OuterRef('thread'), mailbox=mailbox, trashed_at__isnull=True,
    ).filter(Q(last_read_at__isnull=True) | Q(last_read_at__lt=OuterRef('created_at')))
    count = Message.objects.filter(Exists(unread_for_me)).exclude(sender=mailbox).count()
    return Response({'count': count})


# ------------------------------------------------------------------ grammar (self-hosted LanguageTool)

MAX_GRAMMAR_CHARS = 20_000


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grammar_view(request):
    """Check text with the LanguageTool server on this machine. Text never leaves the server."""
    if not settings.LANGUAGETOOL_URL:
        return Response({'detail': 'Grammar checking is not set up on this server.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    text = request.data.get('text') or ''
    if not text.strip():
        return Response({'matches': []})
    if len(text) > MAX_GRAMMAR_CHARS:
        raise ValidationError({'text': f'Check at most {MAX_GRAMMAR_CHARS} characters at a time.'})
    payload = urllib.parse.urlencode({'text': text, 'language': settings.LANGUAGETOOL_LANGUAGE}).encode()
    url = settings.LANGUAGETOOL_URL.rstrip('/') + '/v2/check'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=payload, method='POST'), timeout=15) as resp:
            result = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        logger.warning('Grammar check failed: %s', exc)
        return Response({'detail': 'The grammar checker is not responding.'}, status=status.HTTP_502_BAD_GATEWAY)
    matches = [{
        'offset': m.get('offset', 0),
        'length': m.get('length', 0),
        'message': m.get('message', ''),
        'short': m.get('shortMessage', ''),
        'replacements': [r.get('value', '') for r in (m.get('replacements') or [])[:5]],
        'category': ((m.get('rule') or {}).get('category') or {}).get('name', ''),
    } for m in result.get('matches', [])]
    return Response({'matches': matches})
