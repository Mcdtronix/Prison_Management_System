from rest_framework import serializers

from .files import signed_url
from .models import Draft, Mailbox, Message, Signature
from .richtext import clean_html, html_to_text, text_to_html, with_signed_images


def mailbox_brief(mailbox):
    """Who a mailbox is, in words: department, unit and address."""
    if mailbox is None:
        return None
    oud = mailbox.org_unit_department
    return {
        'id': mailbox.id,
        'address': mailbox.mailbox_address,
        'department': oud.department.name,
        'unit': oud.org_unit.name,
        'unit_type': oud.org_unit.unit_type,
    }


def officer_name(user):
    if user is None:
        return None
    return user.get_full_name().strip() or user.username


def readable_html(request, message_html, plain_text):
    """Display HTML for a message: formatted body with signed picture links, or the plain body as HTML."""
    if not message_html:
        return text_to_html(plain_text)
    return with_signed_images(message_html, lambda image_id: signed_url(request, 'inline', image_id))


# ------------------------------------------------------------------ directory

class MailboxSerializer(serializers.ModelSerializer):
    org_unit_name = serializers.CharField(source='org_unit_department.org_unit.name', read_only=True)
    unit_type = serializers.CharField(source='org_unit_department.org_unit.unit_type', read_only=True)
    department_name = serializers.CharField(source='org_unit_department.department.name', read_only=True)

    class Meta:
        model = Mailbox
        fields = ('id', 'mailbox_address', 'org_unit_department', 'org_unit_name', 'unit_type', 'department_name')


# ------------------------------------------------------------------ messages

class MessageSerializer(serializers.ModelSerializer):
    """A message as a participant reads it."""
    sender = serializers.SerializerMethodField()
    sent_by_name = serializers.SerializerMethodField()
    body_html = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'thread', 'sender', 'sent_by_name', 'body', 'body_html', 'importance',
                  'created_at', 'attachments', 'is_mine')
        read_only_fields = fields

    def get_sender(self, obj):
        return mailbox_brief(obj.sender)

    def get_sent_by_name(self, obj):
        return officer_name(obj.sent_by)

    def get_body_html(self, obj):
        return readable_html(self.context['request'], obj.body_html, obj.body)

    def get_attachments(self, obj):
        request = self.context['request']
        return [{
            'id': a.id, 'name': a.display_name, 'size': a.size, 'content_type': a.content_type,
            'url': signed_url(request, 'attachment', a.id),
        } for a in obj.attachments.all()]

    def get_is_mine(self, obj):
        mailbox = getattr(self.context['request'], 'mailbox', None)
        return mailbox is not None and obj.sender_id == mailbox.id


class ReplySerializer(serializers.Serializer):
    """Input for a reply. Send `body_html` (formatted) or `body` (plain)."""
    thread = serializers.IntegerField()
    body = serializers.CharField(required=False, allow_blank=True, default='')
    body_html = serializers.CharField(required=False, allow_blank=True, default='')
    importance = serializers.ChoiceField(choices=[c for c, _ in Message.IMPORTANCE], default='NORMAL')


# ------------------------------------------------------------------ conversations

class ThreadSummarySerializer(serializers.Serializer):
    """One row in a folder: built from the caller's ThreadParticipant, annotated in ThreadViewSet.list."""
    id = serializers.IntegerField(source='thread_id')
    subject = serializers.CharField(source='thread.subject')
    participants = serializers.SerializerMethodField()
    last_message_at = serializers.DateTimeField(source='thread.last_message_at')
    snippet = serializers.CharField()
    last_sender = serializers.SerializerMethodField()
    message_count = serializers.IntegerField()
    unread_count = serializers.IntegerField()
    starred = serializers.BooleanField()
    archived = serializers.SerializerMethodField()
    trashed = serializers.SerializerMethodField()
    important = serializers.BooleanField()
    has_attachments = serializers.BooleanField()

    def get_participants(self, obj):
        return [mailbox_brief(p.mailbox) for p in obj.thread.participants.all()]

    def get_last_sender(self, obj):
        return mailbox_brief(self.context.get('mailboxes', {}).get(obj.last_sender_id))

    def get_archived(self, obj):
        return obj.archived_at is not None

    def get_trashed(self, obj):
        return obj.trashed_at is not None


class ThreadDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='thread.id')
    subject = serializers.CharField(source='thread.subject')
    created_at = serializers.DateTimeField(source='thread.created_at')
    last_message_at = serializers.DateTimeField(source='thread.last_message_at')
    participants = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()
    starred = serializers.BooleanField()
    archived = serializers.SerializerMethodField()
    trashed = serializers.SerializerMethodField()

    def get_participants(self, obj):
        return [mailbox_brief(p.mailbox) for p in obj.thread.participants.all()]

    def get_messages(self, obj):
        return MessageSerializer(obj.thread.messages.all(), many=True, context=self.context).data

    def get_archived(self, obj):
        return obj.archived_at is not None

    def get_trashed(self, obj):
        return obj.trashed_at is not None


class ThreadStateSerializer(serializers.Serializer):
    """Change the caller's own view of one or more conversations."""
    ids = serializers.ListField(child=serializers.IntegerField(), required=False, max_length=200)
    starred = serializers.BooleanField(required=False)
    archived = serializers.BooleanField(required=False)
    trashed = serializers.BooleanField(required=False)
    read = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not {'starred', 'archived', 'trashed', 'read'} & set(attrs):
            raise serializers.ValidationError('Nothing to change.')
        return attrs


# ------------------------------------------------------------------ drafts and signatures

class _CleanHtmlMixin:
    def validate_body_html(self, value):
        try:
            return clean_html(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))


class DraftSerializer(_CleanHtmlMixin, serializers.ModelSerializer):
    recipients = serializers.ListField(child=serializers.CharField(max_length=254), required=False, max_length=200)

    class Meta:
        model = Draft
        fields = ('id', 'recipients', 'subject', 'body_html', 'importance', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['recipients'] = [r for r in instance.recipients.split(',') if r]
        data['body_html'] = readable_html(self.context['request'], instance.body_html, instance.body)
        return data

    def _prepare(self, validated):
        if 'recipients' in validated:
            validated['recipients'] = ','.join(r.strip() for r in validated['recipients'] if r.strip())
        if 'body_html' in validated:
            validated['body'] = html_to_text(validated['body_html'])
        return validated

    def create(self, validated_data):
        return super().create(self._prepare(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._prepare(validated_data))


class SignatureSerializer(_CleanHtmlMixin, serializers.ModelSerializer):
    class Meta:
        model = Signature
        fields = ('body_html', 'auto_insert', 'updated_at')
        read_only_fields = ('updated_at',)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['body_html'] = readable_html(self.context['request'], instance.body_html, '')
        return data
