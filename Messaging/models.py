from django.db import models
from django.conf import settings


class Mailbox(models.Model):
    """Represents a mailbox identity (backed by OrgUnitDepartment)."""
    org_unit_department = models.OneToOneField('Auth.OrgUnitDepartment', on_delete=models.CASCADE, related_name='mailbox')
    mailbox_address = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_mailbox'

    def __str__(self):
        return self.mailbox_address


class Thread(models.Model):
    subject = models.CharField(max_length=255)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='threads')
    owner_org_unit = models.ForeignKey('Auth.OrgUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='threads')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_thread'

    def __str__(self):
        return f"{self.id} - {self.subject}"


class ThreadParticipant(models.Model):
    thread = models.ForeignKey(Thread, related_name='participants', on_delete=models.CASCADE)
    mailbox = models.ForeignKey(Mailbox, related_name='threads', on_delete=models.CASCADE)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'messaging_threadparticipant'
        unique_together = [('thread', 'mailbox')]

    def __str__(self):
        return f"{self.mailbox.mailbox_address} in {self.thread.id}"


class Message(models.Model):
    thread = models.ForeignKey(Thread, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(Mailbox, related_name='sent_messages', on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(Mailbox, related_name='read_messages', blank=True)
    # Folder status will be inferred; drafts are stored separately.
    folder = models.CharField(max_length=16, default='INBOX', help_text='INBOX/OUTBOX/DRAFT')

    class Meta:
        db_table = 'messaging_message'
        ordering = ['created_at']

    def __str__(self):
        return f"Msg {self.id} in {self.thread.id}"


class Attachment(models.Model):
    message = models.ForeignKey(Message, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to='attachments/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_attachment'

    def __str__(self):
        return f"Attachment {self.id} for {self.message.id}"
