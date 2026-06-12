from django.contrib import admin
from .models import Mailbox, Thread, ThreadParticipant, Message, Attachment

from .models import Attachment as MessagingAttachment


@admin.register(Mailbox)
class MailboxAdmin(admin.ModelAdmin):
    list_display = ('mailbox_address', 'org_unit_department')
    search_fields = ('mailbox_address',)


class ThreadParticipantInline(admin.TabularInline):
    model = ThreadParticipant
    extra = 0


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'created_by', 'created_at')
    inlines = [ThreadParticipantInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'thread', 'sender', 'created_at')
    inlines = [AttachmentInline]


@admin.register(Attachment)
class MessagingAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'uploaded_at')
