from django.db import models

from .models import Message


class Draft(models.Model):
    mailbox = models.ForeignKey('Messaging.Mailbox', on_delete=models.CASCADE, related_name='drafts')
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_draft'

    def __str__(self):
        return f"Draft {self.id} ({self.mailbox.mailbox_address})"
