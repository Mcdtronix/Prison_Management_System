"""Messaging admin: read-only views for support and audit. Messages are a
record; they are not edited or deleted here."""
from django.contrib import admin

from .models import Attachment, Draft, InlineImage, Mailbox, Message, Signature, Thread, ThreadParticipant


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Mailbox)
class MailboxAdmin(admin.ModelAdmin):
    list_display = ('mailbox_address', 'org_unit_department', 'created_at')
    search_fields = ('mailbox_address', 'org_unit_department__org_unit__name', 'org_unit_department__department__name')
    readonly_fields = ('org_unit_department', 'mailbox_address', 'created_at')

    def has_add_permission(self, request):
        return False  # created automatically with each department


class ThreadParticipantInline(ReadOnlyInline):
    model = ThreadParticipant
    fields = ('mailbox', 'last_read_at', 'starred', 'archived_at', 'trashed_at')


class MessageInline(ReadOnlyInline):
    model = Message
    fields = ('sender', 'sent_by', 'importance', 'created_at', 'body')


@admin.register(Thread)
class ThreadAdmin(ReadOnlyAdmin):
    list_display = ('id', 'subject', 'created_by', 'created_at', 'last_message_at')
    search_fields = ('subject', 'participants__mailbox__mailbox_address')
    inlines = [ThreadParticipantInline, MessageInline]


class AttachmentInline(ReadOnlyInline):
    model = Attachment
    fields = ('original_name', 'content_type', 'size', 'uploaded_at')


@admin.register(Message)
class MessageAdmin(ReadOnlyAdmin):
    list_display = ('id', 'thread', 'sender', 'sent_by', 'importance', 'created_at')
    list_filter = ('importance',)
    search_fields = ('body', 'thread__subject', 'sender__mailbox_address', 'sent_by__username')
    inlines = [AttachmentInline]


@admin.register(Attachment)
class AttachmentAdmin(ReadOnlyAdmin):
    list_display = ('id', 'original_name', 'message', 'content_type', 'size', 'uploaded_at')
    search_fields = ('original_name',)


@admin.register(InlineImage)
class InlineImageAdmin(ReadOnlyAdmin):
    list_display = ('id', 'message', 'uploaded_by', 'size', 'created_at')


@admin.register(Draft)
class DraftAdmin(ReadOnlyAdmin):
    list_display = ('id', 'mailbox', 'subject', 'updated_at')


@admin.register(Signature)
class SignatureAdmin(ReadOnlyAdmin):
    list_display = ('user', 'auto_insert', 'updated_at')
