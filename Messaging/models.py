"""Messaging data model.

A *mailbox* is a department at an org unit (reception@chivhu). People send
and receive through the mailbox of their primary assignment; every message
also records the officer who wrote it.

Per-mailbox state (read up to, starred, archived, in trash) lives on
ThreadParticipant, so one department archiving a conversation never affects
anyone else. Nothing is hard-deleted through the API: "delete" moves a
conversation to that mailbox's trash.
"""
import os
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def _dated_path(prefix, filename):
    """messaging/<prefix>/YYYY/MM/<random>.<ext>: no user-chosen names on disk."""
    ext = os.path.splitext(filename)[1].lower()[:10]
    return f'messaging/{prefix}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}'


def attachment_upload_to(instance, filename):
    return _dated_path('attachments', filename)


def inline_image_upload_to(instance, filename):
    return _dated_path('inline', filename)


class Mailbox(models.Model):
    """A mailbox identity, one per OrgUnitDepartment (created automatically)."""
    org_unit_department = models.OneToOneField('Auth.OrgUnitDepartment', on_delete=models.CASCADE, related_name='mailbox')
    mailbox_address = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_mailbox'

    def __str__(self):
        return self.mailbox_address


class Thread(models.Model):
    """A conversation between two or more mailboxes."""
    subject = models.CharField(max_length=255)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='threads')
    owner_org_unit = models.ForeignKey('Auth.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='threads')
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True,
                                           help_text='Time of the newest message; orders the inbox.')

    class Meta:
        db_table = 'messaging_thread'

    def __str__(self):
        return f"{self.id} - {self.subject}"


class ThreadParticipant(models.Model):
    """One mailbox in one conversation, with that mailbox's own view of it."""
    thread = models.ForeignKey(Thread, related_name='participants', on_delete=models.CASCADE)
    mailbox = models.ForeignKey(Mailbox, related_name='threads', on_delete=models.CASCADE)
    last_read_at = models.DateTimeField(null=True, blank=True,
                                        help_text='Messages after this time are unread for this mailbox.')
    starred = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    trashed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'messaging_threadparticipant'
        unique_together = [('thread', 'mailbox')]
        indexes = [models.Index(fields=['mailbox', 'trashed_at', 'archived_at'], name='msg_participant_folder_idx')]

    def __str__(self):
        return f"{self.mailbox.mailbox_address} in {self.thread_id}"


class Message(models.Model):
    IMPORTANCE = [('LOW', 'Low'), ('NORMAL', 'Normal'), ('HIGH', 'High')]

    thread = models.ForeignKey(Thread, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(Mailbox, related_name='sent_messages', on_delete=models.SET_NULL, null=True)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='sent_messages', help_text='The officer who wrote the message.')
    body = models.TextField(blank=True, help_text='Plain-text version; used for previews and search.')
    body_html = models.TextField(blank=True, help_text='Sanitised formatted version. Empty for plain messages.')
    importance = models.CharField(max_length=6, choices=IMPORTANCE, default='NORMAL')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'messaging_message'
        ordering = ['created_at']

    def __str__(self):
        return f"Msg {self.id} in {self.thread_id}"


class Attachment(models.Model):
    message = models.ForeignKey(Message, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to=attachment_upload_to, max_length=255)
    original_name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_attachment'

    def __str__(self):
        return f"Attachment {self.id} for {self.message_id}"

    @property
    def display_name(self):
        return self.original_name or os.path.basename(self.file.name)


class InlineImage(models.Model):
    """A picture placed inside a message body. Uploaded while composing,
    linked to its message on send."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.ImageField(upload_to=inline_image_upload_to, max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                                    related_name='messaging_inline_images')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True, related_name='inline_images')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_inline_image'

    def __str__(self):
        return f"Inline image {self.id}"


class Draft(models.Model):
    """An unsent new message, private to the mailbox that saved it."""
    mailbox = models.ForeignKey(Mailbox, on_delete=models.CASCADE, related_name='drafts')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='messaging_drafts')
    recipients = models.TextField(blank=True, help_text='Comma-separated mailbox addresses.')
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    body_html = models.TextField(blank=True)
    importance = models.CharField(max_length=6, choices=Message.IMPORTANCE, default='NORMAL')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'messaging_draft'
        ordering = ['-updated_at']

    def __str__(self):
        return f"Draft {self.id} ({self.mailbox.mailbox_address})"


class Signature(models.Model):
    """An officer's email-style signature, added to new messages and replies."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messaging_signature')
    body_html = models.TextField(blank=True)
    auto_insert = models.BooleanField(default=True, help_text='Add automatically when composing.')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'messaging_signature'

    def __str__(self):
        return f"Signature of {self.user}"
