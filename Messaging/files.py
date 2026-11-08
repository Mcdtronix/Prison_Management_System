"""Attachments and in-message pictures: upload checks and protected downloads.

Files are never served straight from /media/. The API hands out signed links
that expire after FILE_LINK_MAX_AGE and are tied to the reader's user and
mailbox. A link only works while that mailbox is still in the conversation.
In production Django answers with X-Accel-Redirect so nginx streams the file
from its internal /media/ location (see deploy/nginx/pms.conf).
"""
import mimetypes
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse
from django.urls import reverse
from django.utils.http import content_disposition_header
from django.views.decorators.http import require_GET
from rest_framework.exceptions import ValidationError

from .models import Attachment, InlineImage, ThreadParticipant

SALT = 'messaging.file-link'
FILE_LINK_MAX_AGE = 4 * 60 * 60  # seconds; a link works like a password for one file
INLINE_IMAGE_TYPES = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp'}


# ------------------------------------------------------------------ uploads

def check_attachments(files):
    """Reject the batch if any file breaks the count, size or type limits."""
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
        if not f.size:
            raise ValidationError({'attachments': f'{f.name} is empty.'})
        # The bytes must really be that type: a renamed program is refused (Core/uploads.py).
        from Core.uploads import content_matches
        if not content_matches(f, ext):
            raise ValidationError({'attachments': f'{f.name} is not a genuine .{ext} file.'})
    return files


def save_attachments(message, files):
    for f in files:
        content_type = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        Attachment.objects.create(message=message, file=f, original_name=os.path.basename(f.name)[:255],
                                  content_type=content_type, size=f.size)


def check_inline_image(upload):
    """A real picture of an allowed type within the size limit, or 400."""
    from PIL import Image, UnidentifiedImageError

    ext = os.path.splitext(upload.name)[1].lstrip('.').lower()
    if ext not in INLINE_IMAGE_TYPES:
        raise ValidationError({'file': 'Pictures must be PNG, JPEG, GIF or WebP.'})
    if upload.size > settings.MESSAGING_MAX_INLINE_IMAGE_BYTES:
        raise ValidationError({'file': f'Pictures must be under {settings.MESSAGING_MAX_INLINE_IMAGE_BYTES // (1024 * 1024)} MB.'})
    try:
        Image.open(upload).verify()
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValidationError({'file': 'That file is not a valid picture.'})
    upload.seek(0)
    return INLINE_IMAGE_TYPES[ext]


# ------------------------------------------------------------------ signed links

def signed_url(request, kind, obj_id):
    """A download link for `kind` ('attachment' or 'inline') valid for the caller only."""
    token = signing.dumps({'u': request.user.pk, 'm': getattr(request.mailbox, 'pk', None),
                           'k': kind, 'i': str(obj_id)}, salt=SALT, compress=True)
    path = reverse('messaging-file', kwargs={'kind': kind, 'obj_id': str(obj_id)})
    return request.build_absolute_uri(f'{path}?t={token}')


def _in_thread(mailbox_id, thread_id):
    return bool(mailbox_id) and ThreadParticipant.objects.filter(thread_id=thread_id, mailbox_id=mailbox_id).exists()


@require_GET
def download(request, kind, obj_id):
    """Serve a file to the holder of a valid signed link. Every failure is a plain 404."""
    try:
        claims = signing.loads(request.GET.get('t', ''), salt=SALT, max_age=FILE_LINK_MAX_AGE)
    except signing.BadSignature:
        raise Http404
    if claims.get('k') != kind or claims.get('i') != str(obj_id):
        raise Http404
    if not get_user_model().objects.filter(pk=claims.get('u'), is_active=True).exists():
        raise Http404

    if kind == 'attachment':
        item = Attachment.objects.select_related('message').filter(pk=obj_id).first()
        if item is None or not _in_thread(claims.get('m'), item.message.thread_id):
            raise Http404
        return _serve(item.file, item.display_name, item.content_type, as_attachment=True)

    if kind == 'inline':
        item = InlineImage.objects.select_related('message').filter(pk=obj_id).first()
        if item is None:
            raise Http404
        own_unsent = item.message_id is None and item.uploaded_by_id == claims.get('u')
        if not own_unsent and not (item.message_id and _in_thread(claims.get('m'), item.message.thread_id)):
            raise Http404
        return _serve(item.file, os.path.basename(item.file.name), item.content_type, as_attachment=False)

    raise Http404


def _serve(field_file, filename, content_type, as_attachment):
    if not field_file or not field_file.storage.exists(field_file.name):
        raise Http404
    content_type = content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    if settings.MESSAGING_X_ACCEL_REDIRECT:
        response = HttpResponse(content_type=content_type)
        response['X-Accel-Redirect'] = f'/media/{field_file.name}'
    else:
        response = FileResponse(field_file.open('rb'), content_type=content_type)
    response['Content-Disposition'] = content_disposition_header(as_attachment, filename)
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'private, max-age=3600'
    return response
