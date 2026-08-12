from rest_framework import serializers
from .models import Mailbox, Thread, ThreadParticipant, Message, Attachment
from .models_extra import Draft
from Auth.models import OrgUnitDepartment


class MailboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mailbox
        fields = ('id', 'mailbox_address', 'org_unit_department')


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ('id', 'file', 'uploaded_at')


class MessageSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ('id', 'thread', 'sender', 'body', 'created_at', 'attachments')
        read_only_fields = ('created_at',)


class ThreadParticipantSerializer(serializers.ModelSerializer):
    mailbox = MailboxSerializer(read_only=True)

    class Meta:
        model = ThreadParticipant
        fields = ('id', 'thread', 'mailbox', 'last_read_at')


class ThreadSerializer(serializers.ModelSerializer):
    participants = ThreadParticipantSerializer(many=True, read_only=True)
    messages = MessageSerializer(many=True, read_only=True)
    is_unread = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = ('id', 'subject', 'created_by', 'owner_org_unit', 'created_at', 'participants', 'messages', 'is_unread')
        read_only_fields = ('created_at', 'created_by')

    def get_is_unread(self, obj):
        request = self.context.get('request')
        mailbox = getattr(request, 'mailbox', None) if request else None
        if mailbox:
            return obj.messages.exclude(read_by=mailbox).exists()
        return False


class DraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Draft
        fields = ('id', 'mailbox', 'subject', 'body', 'created_at')
        read_only_fields = ('created_at',)
