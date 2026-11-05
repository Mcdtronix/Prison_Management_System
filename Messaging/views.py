"""Messaging API.

Access rules (every endpoint follows them):

* A user acts through one mailbox: their primary assignment's department at
  their org unit (`request.mailbox`, set by MailboxContextMiddleware).
* You only ever see conversations your mailbox takes part in, and only the
  messages inside them.
* Starting a conversation checks every recipient against the sender's allowed
  recipients (`request.message_recipients`). An empty list allows no one.
  Unknown addresses are refused; nothing is created from a typed address.
* Anyone already in a conversation may reply in it. Recipients were checked
  when the conversation started.
* Messages and conversations cannot be edited or deleted through the API, so
  the record stays intact.
"""
import os

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Auth.models import OrgUnitDepartment

from .models import Attachment, Mailbox, Message, Thread, ThreadParticipant
from .models_extra import Draft
from .permissions import MessagingPermission
from .serializers import DraftSerializer, MailboxSerializer, MessageSerializer, ThreadSerializer

READ_AND_CREATE = ['get', 'post', 'head', 'options']


# ------------------------------------------------------------------ helpers

def _own_mailbox(request):
    """The caller's mailbox, or 403 if their account has none."""
    mailbox = getattr(request, 'mailbox', None)
    if mailbox is None:
        raise PermissionDenied('Your account has no mailbox. Ask an administrator to assign you a department.')
    return mailbox


def _uploaded_files(request):
    """Attachments on the request, checked against the size, count and type limits."""
    files = request.FILES.getlist('attachments') if hasattr(request.FILES, 'getlist') else []
    if len(files) > settings.MESSAGING_MAX_ATTACHMENTS:
        raise ValidationError({'attachments': f'At most {settings.MESSAGING_MAX_ATTACHMENTS} files per message.'})
    allowed = {ext.lower() for ext in settings.ALLOWED_UPLOAD_EXTENSIONS}
    limit_mb = settings.MESSAGING_MAX_ATTACHMENT_BYTES // (1024 * 1024)
    for f in files:
        ext = os.path.splitext(f.name)[1].lstrip('.').lower()
        if ext not in allowed:
            raise ValidationError({'attachments': f'{f.name}: file type not allowed. Use {", ".join(sorted(allowed))}.'})
        if f.size > settings.MESSAGING_MAX_ATTACHMENT_BYTES:
            raise ValidationError({'attachments': f'{f.name} is larger than {limit_mb} MB.'})
    return files


def _addresses(data):
    """Recipient addresses from a list field or one comma-separated string, de-duplicated."""
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
    mailbox = (Mailbox.objects.select_related('org_unit_department')
               .filter(mailbox_address__iexact=address).first())
    if mailbox is None:
        oud = OrgUnitDepartment.objects.filter(mailbox_address__iexact=address).first()
        if oud is None:
            raise ValidationError({'participants': f'Unknown mailbox: {address}'})
        mailbox, _ = Mailbox.objects.get_or_create(
            org_unit_department=oud, defaults={'mailbox_address': oud.mailbox_address})
    if not mailbox.org_unit_department.active:
        raise ValidationError({'participants': f'Mailbox is not active: {mailbox.mailbox_address}'})
    return mailbox


def _allowed_department_ids(request):
    """Ids of the OrgUnitDepartments the caller may start a conversation with."""
    return {oud.id for oud in (getattr(request, 'message_recipients', None) or {}).values()}


def _add_message(thread, sender, body, files):
    message = Message.objects.create(thread=thread, sender=sender, body=body)
    message.read_by.add(sender)
    for f in files:
        Attachment.objects.create(message=message, file=f)
    return message


# ------------------------------------------------------------------ viewsets

class MailboxViewSet(viewsets.ReadOnlyModelViewSet):
    """Mailbox directory (addresses only) plus your own inbox, outbox and drafts."""
    queryset = Mailbox.objects.select_related('org_unit_department').all()
    serializer_class = MailboxSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(mailbox_address__icontains=q) |
                Q(org_unit_department__org_unit__name__icontains=q) |
                Q(org_unit_department__org_unit__code__icontains=q)
            )
        return qs.order_by('mailbox_address')

    def _own(self, request):
        """The mailbox in the URL, which must be the caller's own."""
        mailbox = self.get_object()
        if mailbox != _own_mailbox(request):
            raise PermissionDenied('You can only open your own mailbox.')
        return mailbox

    @action(detail=True, methods=['get'])
    def inbox(self, request, pk=None):
        mailbox = self._own(request)
        msgs = Message.objects.filter(thread__participants__mailbox=mailbox).distinct().order_by('-created_at')
        return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=['get'])
    def outbox(self, request, pk=None):
        mailbox = self._own(request)
        msgs = Message.objects.filter(sender=mailbox).order_by('-created_at')
        return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=['get', 'post'])
    def drafts(self, request, pk=None):
        mailbox = self._own(request)
        if request.method == 'GET':
            drafts = Draft.objects.filter(mailbox=mailbox).order_by('-created_at')
            return Response(DraftSerializer(drafts, many=True).data)
        serializer = DraftSerializer(data={
            'mailbox': mailbox.id,
            'subject': request.data.get('subject', ''),
            'body': request.data.get('body', ''),
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ThreadViewSet(viewsets.ModelViewSet):
    """Conversations your mailbox takes part in. Create, read and mark read only."""
    queryset = Thread.objects.all()
    serializer_class = ThreadSerializer
    permission_classes = (IsAuthenticated, MessagingPermission)
    http_method_names = READ_AND_CREATE

    def get_queryset(self):
        mailbox = getattr(self.request, 'mailbox', None)
        if mailbox is None:
            return Thread.objects.none()
        qs = Thread.objects.filter(participants__mailbox=mailbox)
        if self.request.query_params.get('folder') == 'sent':
            qs = qs.filter(messages__sender=mailbox)
        return qs.distinct().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Start a conversation.

        Fields: `subject`, `participants` (addresses, list or comma-separated),
        optional `initial_body`, optional files under `attachments`.
        """
        sender = _own_mailbox(request)
        data = request.data
        serializer = self.get_serializer(data={'subject': (data.get('subject') or '').strip()})
        serializer.is_valid(raise_exception=True)

        addresses = [a for a in _addresses(data) if a.lower() != sender.mailbox_address.lower()]
        if not addresses:
            raise ValidationError({'participants': 'Add at least one recipient.'})
        if len(addresses) > settings.MAX_THREAD_RECIPIENTS:
            raise ValidationError({'participants': f'At most {settings.MAX_THREAD_RECIPIENTS} recipients.'})

        recipients = [_resolve_recipient(a) for a in addresses]
        allowed = _allowed_department_ids(request)
        refused = [m.mailbox_address for m in recipients if m.org_unit_department_id not in allowed]
        if refused:
            raise PermissionDenied(f'You may not message: {", ".join(refused)}')

        body = data.get('initial_body') or ''
        files = _uploaded_files(request)

        with transaction.atomic():
            thread = serializer.save(created_by=request.user, owner_org_unit=getattr(request, 'org_unit', None))
            ThreadParticipant.objects.create(thread=thread, mailbox=sender)
            for mailbox in recipients:
                ThreadParticipant.objects.get_or_create(thread=thread, mailbox=mailbox)
            message = _add_message(thread, sender, body, files) if (body.strip() or files) else None

        output = dict(self.get_serializer(thread).data)
        if message is not None:
            output['initial_message'] = MessageSerializer(message).data
        return Response(output, status=status.HTTP_201_CREATED)

    def _mark_read(self, thread, mailbox):
        ThreadParticipant.objects.filter(thread=thread, mailbox=mailbox).update(last_read_at=timezone.now())
        for m in thread.messages.exclude(read_by=mailbox):
            m.read_by.add(mailbox)

    def retrieve(self, request, *args, **kwargs):
        """Open a conversation; marks it read for your mailbox."""
        thread = self.get_object()
        self._mark_read(thread, request.mailbox)
        return Response(self.get_serializer(thread).data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        thread = self.get_object()
        self._mark_read(thread, _own_mailbox(request))
        return Response({'status': 'ok'})


class MessageViewSet(viewsets.ModelViewSet):
    """Messages in your conversations. Read and reply only."""
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = (IsAuthenticated, MessagingPermission)
    http_method_names = READ_AND_CREATE

    def get_queryset(self):
        mailbox = getattr(self.request, 'mailbox', None)
        if mailbox is None:
            return Message.objects.none()
        return (Message.objects.filter(thread__participants__mailbox=mailbox)
                .select_related('thread').prefetch_related('attachments').distinct().order_by('created_at'))

    def create(self, request, *args, **kwargs):
        sender = _own_mailbox(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        thread = serializer.validated_data['thread']
        if not ThreadParticipant.objects.filter(thread=thread, mailbox=sender).exists():
            raise PermissionDenied('You are not part of this conversation.')
        body = serializer.validated_data.get('body', '')
        files = _uploaded_files(request)
        if not body.strip() and not files:
            raise ValidationError({'body': 'Write a message or attach a file.'})
        with transaction.atomic():
            message = _add_message(thread, sender, body, files)
        return Response(self.get_serializer(message).data, status=status.HTTP_201_CREATED)
