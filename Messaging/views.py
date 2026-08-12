from rest_framework import viewsets, status
from Core.mixins import OrgUnitContextMixin

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from .models import Mailbox, Thread, ThreadParticipant, Message, Attachment
from .serializers import MailboxSerializer, ThreadSerializer, MessageSerializer
from .permissions import MessagingPermission


class MailboxViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Mailbox.objects.select_related('org_unit_department').all()
    serializer_class = MailboxSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get('q')
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(mailbox_address__icontains=q) |
                Q(org_unit_department__org_unit__name__icontains=q) |
                Q(org_unit_department__org_unit__code__icontains=q)
            )
        return qs

    @action(detail=True, methods=['get'])
    def inbox(self, request, pk=None):
        mailbox = self.get_object()
        msgs = Message.objects.filter(thread__participants__mailbox=mailbox).distinct().order_by('-created_at')
        serializer = MessageSerializer(msgs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def outbox(self, request, pk=None):
        mailbox = self.get_object()
        msgs = Message.objects.filter(sender=mailbox).order_by('-created_at')
        serializer = MessageSerializer(msgs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def drafts(self, request, pk=None):
        mailbox = self.get_object()
        if request.method == 'GET':
            from .models_extra import Draft
            drafts = Draft.objects.filter(mailbox=mailbox).order_by('-created_at')
            from .serializers import DraftSerializer
            return Response(DraftSerializer(drafts, many=True).data)
        else:
            from .models_extra import Draft
            from .serializers import DraftSerializer
            data = request.data.copy()
            data['mailbox'] = mailbox.id
            serializer = DraftSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=201)


class ThreadViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Thread.objects.all()
    serializer_class = ThreadSerializer
    permission_classes = (IsAuthenticated, MessagingPermission)

    def get_queryset(self):
        qs = super().get_queryset()
        mailbox = getattr(self.request, 'mailbox', None)
        user = self.request.user

        if not user or not user.is_authenticated:
            return qs.none()

        if not mailbox:
            if getattr(user, 'is_superuser', False):
                return qs.order_by('-created_at')
            return qs.none()

        qs = qs.filter(participants__mailbox=mailbox)

        folder = self.request.query_params.get('folder')
        if folder == 'inbox':
            qs = qs.distinct()
        elif folder == 'sent':
            qs = qs.filter(messages__sender=mailbox).distinct()
        else:
            qs = qs.distinct()

        return qs.order_by('-created_at')
    def create(self, request, *args, **kwargs):
        """Create a thread optionally with an initial message and attachments.

        Accepts `subject`, optional `participants` (list of mailbox_address strings),
        optional `initial_body` and optional file uploads under `attachments`.
        """
        data = request.data.copy()
        subject = data.get('subject') or ''
        serializer = self.get_serializer(data={'subject': subject})
        serializer.is_valid(raise_exception=True)

        # Create thread
        thread = serializer.save(created_by=request.user, owner_org_unit=getattr(request, 'org_unit', None))

        # Add requesting mailbox as participant
        mailbox = getattr(request, 'mailbox', None)
        if mailbox:
            ThreadParticipant.objects.create(thread=thread, mailbox=mailbox)

        # Add additional participants if provided and allowed by mailbox context
        participant_addresses = data.getlist('participants') if hasattr(data, 'getlist') else data.get('participants') or []
        if isinstance(participant_addresses, str):
            # single comma-separated
            participant_addresses = [a.strip() for a in participant_addresses.split(',') if a.strip()]

        allowed = getattr(request, 'message_recipients', {}) or {}
        for addr in participant_addresses:
            try:
                mb = Mailbox.objects.select_related('org_unit_department').get(mailbox_address=addr)
            except Mailbox.DoesNotExist:
                from Auth.models import OrgUnitDepartment
                try:
                    oud = OrgUnitDepartment.objects.get(mailbox_address=addr)
                    mb = Mailbox.objects.create(org_unit_department=oud, mailbox_address=addr)
                except OrgUnitDepartment.DoesNotExist:
                    # Attempt to parse and auto-create the OrgUnitDepartment
                    parts = addr.split('@')
                    created_oud = None
                    if len(parts) == 2 and parts[1].endswith('.pms.local'):
                        dept_code = parts[0].upper()
                        domain_prefix = parts[1][:-10]
                        from Auth.models import OrgUnit, Department
                        dept = Department.objects.filter(code=dept_code).first()
                        if dept:
                            for ou in OrgUnit.objects.all():
                                if ou.unit_type == 'NATIONAL_HQ' and domain_prefix == 'nat-hq':
                                    created_oud, _ = OrgUnitDepartment.objects.get_or_create(org_unit=ou, department=dept, defaults={'active': True})
                                    break
                                elif ou.code.lower().replace('_', '-') == domain_prefix or ou.code.lower() == domain_prefix:
                                    created_oud, _ = OrgUnitDepartment.objects.get_or_create(org_unit=ou, department=dept, defaults={'active': True})
                                    break
                    if created_oud:
                        mb, _ = Mailbox.objects.get_or_create(
                            org_unit_department=created_oud,
                            defaults={'mailbox_address': created_oud.mailbox_address}
                        )
                    else:
                        thread.delete()
                        raise ValidationError(f'Unknown mailbox: {addr}')
            if allowed and mb.mailbox_address not in allowed:
                thread.delete()
                raise PermissionDenied(f'Recipient not allowed: {mb.mailbox_address}')
            ThreadParticipant.objects.get_or_create(thread=thread, mailbox=mb)

        # Optionally create initial message
        initial_body = data.get('initial_body')
        created_message = None
        if initial_body:
            # Ensure the sender (request.mailbox) is a participant
            if mailbox is None:
                thread.delete()
                raise PermissionDenied('Missing mailbox context')
            if not ThreadParticipant.objects.filter(thread=thread, mailbox=mailbox).exists():
                thread.delete()
                raise PermissionDenied('Sender mailbox not a participant')

            # Create message
            created_message = Message.objects.create(thread=thread, sender=mailbox, body=initial_body)
            created_message.read_by.add(mailbox)

            # Save attachments from request.FILES
            files = request.FILES.getlist('attachments') if hasattr(request.FILES, 'getlist') else []
            for f in files:
                Attachment.objects.create(message=created_message, file=f)

        output = self.get_serializer(thread).data
        # If we created a message, include it in response under `initial_message` key
        if created_message:
            msg_ser = MessageSerializer(created_message)
            output = dict(output)
            output['initial_message'] = msg_ser.data

        headers = self.get_success_headers(serializer.data)
        return Response(output, status=status.HTTP_201_CREATED, headers=headers)

    def retrieve(self, request, *args, **kwargs):
        """Retrieve a thread and mark messages as read for the requesting mailbox."""
        instance = self.get_object()
        mailbox = getattr(request, 'mailbox', None)
        # Update last_read_at for participant
        if mailbox:
            tp, _ = ThreadParticipant.objects.get_or_create(thread=instance, mailbox=mailbox)
            tp.last_read_at = timezone.now()
            tp.save()
            # Mark existing messages as read by this mailbox
            for m in instance.messages.exclude(read_by=mailbox):
                m.read_by.add(mailbox)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages in this thread as read for the requesting mailbox."""
        thread = self.get_object()
        mailbox = getattr(request, 'mailbox', None)
        if mailbox is None:
            raise PermissionDenied('Missing mailbox context')
        tp, _ = ThreadParticipant.objects.get_or_create(thread=thread, mailbox=mailbox)
        tp.last_read_at = timezone.now()
        tp.save()
        for m in thread.messages.exclude(read_by=mailbox):
            m.read_by.add(mailbox)
        return Response({'status': 'ok'})


class MessageViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Message.objects.select_related('thread').all()
    serializer_class = MessageSerializer
    permission_classes = (IsAuthenticated, MessagingPermission)

    def perform_create(self, serializer):
        mailbox = getattr(self.request, 'mailbox', None)
        # Validate sender matches request.mailbox
        if mailbox is None:
            raise PermissionError('Missing mailbox context')

        # Ensure thread exists and sender is a participant
        thread = serializer.validated_data.get('thread')
        if thread is None:
            raise ValidationError('thread is required')

        # Check thread participant membership
        if not ThreadParticipant.objects.filter(thread=thread, mailbox=mailbox).exists():
            # If sender not participant, deny
            raise PermissionDenied('Sender mailbox not a participant of the thread')

        # Optionally validate that recipients (thread participants) are allowed
        allowed = getattr(self.request, 'message_recipients', {}) or {}
        # If allowed map is present, ensure all participants are permitted
        participants = ThreadParticipant.objects.filter(thread=thread).select_related('mailbox')
        if allowed:
            for p in participants:
                if p.mailbox.mailbox_address not in allowed and p.mailbox != mailbox:
                    raise PermissionDenied(f'Participant not allowed: {p.mailbox.mailbox_address}')

        # Save message and handle attachments
        msg = serializer.save(sender=mailbox)
        msg.read_by.add(mailbox)
        files = self.request.FILES.getlist('attachments') if hasattr(self.request.FILES, 'getlist') else []
        for f in files:
            Attachment.objects.create(message=msg, file=f)
        return msg
