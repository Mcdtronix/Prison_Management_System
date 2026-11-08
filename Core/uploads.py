"""Upload checks shared by every file the system accepts.

A file is accepted only if all of these hold:

* its extension is on the allow-list for its kind;
* it is not empty and not larger than the limit for its kind;
* its contents really are that type. The first bytes must match the format
  (a PDF starts with %PDF-, a Word .docx is a zip holding word/…), so a
  script renamed to warrant.pdf is refused. Pictures must also open in Pillow.

Kinds:
    'document'  court warrants, receipts, certificates, officer documents:
                settings.ALLOWED_UPLOAD_EXTENSIONS, up to UPLOAD_MAX_DOCUMENT_BYTES
    'photo'     inmate photographs: jpg, jpeg, png, webp, up to UPLOAD_MAX_PHOTO_BYTES

Use `UploadValidator('document')` in a model or serializer field's
`validators`, or `check_upload(file, 'document')` where a view reads
request.FILES itself.
"""
import os
import zipfile

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

PHOTO_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')
IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}

_OLE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'  # legacy Office (.doc, .xls)
_SIGNATURES = {
    'pdf': (b'%PDF-',),
    'jpg': (b'\xff\xd8\xff',),
    'jpeg': (b'\xff\xd8\xff',),
    'png': (b'\x89PNG\r\n\x1a\n',),
    'gif': (b'GIF87a', b'GIF89a'),
    'doc': (_OLE,),
    'xls': (_OLE,),
    'docx': (b'PK\x03\x04',),
    'xlsx': (b'PK\x03\x04',),
}
_OFFICE_ZIP_FOLDER = {'docx': 'word/', 'xlsx': 'xl/'}


def _rules(kind):
    if kind == 'photo':
        return PHOTO_EXTENSIONS, settings.UPLOAD_MAX_PHOTO_BYTES
    if kind == 'document':
        return tuple(e.lower() for e in settings.ALLOWED_UPLOAD_EXTENSIONS), settings.UPLOAD_MAX_DOCUMENT_BYTES
    raise ValueError(f'Unknown upload kind: {kind}')


def _megabytes(size):
    return f'{size / (1024 * 1024):.0f} MB'


def _head(upload, length=16):
    upload.seek(0)
    head = upload.read(length)
    upload.seek(0)
    return head


def content_matches(upload, ext) -> bool:
    """Do the file's bytes really belong to type `ext`?"""
    head = _head(upload)
    if ext == 'webp':
        return head[:4] == b'RIFF' and head[8:12] == b'WEBP'
    if not any(head.startswith(sig) for sig in _SIGNATURES.get(ext, ())):
        return False
    if ext in _OFFICE_ZIP_FOLDER:
        try:
            upload.seek(0)
            with zipfile.ZipFile(upload) as archive:
                names = archive.namelist()
            folder = _OFFICE_ZIP_FOLDER[ext]
            return '[Content_Types].xml' in names and any(n.startswith(folder) for n in names)
        except zipfile.BadZipFile:
            return False
        finally:
            upload.seek(0)
    if ext in IMAGE_EXTENSIONS:
        from PIL import Image
        try:
            upload.seek(0)
            with Image.open(upload) as image:
                image.verify()
        except Exception:
            return False
        finally:
            upload.seek(0)
    return True


def upload_problem(upload, kind='document'):
    """Why `upload` is refused, or None if it is acceptable."""
    if upload is None:
        return None
    extensions, max_bytes = _rules(kind)
    name = os.path.basename(getattr(upload, 'name', '') or '')
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext not in extensions:
        return f'"{name or "file"}" is not an accepted type. Accepted: {", ".join(extensions)}.'
    size = getattr(upload, 'size', None)
    if not size:
        return f'"{name}" is empty.'
    if size > max_bytes:
        return f'"{name}" is {_megabytes(size)}; the limit is {_megabytes(max_bytes)}.'
    if not content_matches(upload, ext):
        return f'"{name}" is not a genuine .{ext} file. Save or scan it again and re-attach it.'
    return None


@deconstructible
class UploadValidator:
    """Field validator: `validators=[UploadValidator('document')]`."""

    def __init__(self, kind='document'):
        _rules(kind)  # fail fast on a typo
        self.kind = kind

    def __call__(self, value):
        # A model field hands over a FieldFile: skip files already stored (they
        # were checked on the way in) and check the new upload inside one.
        # A serializer field hands over the UploadedFile itself.
        if hasattr(value, '_committed'):
            if value._committed:
                return
            value = value.file
        problem = upload_problem(value, self.kind)
        if problem:
            raise ValidationError(problem, code='invalid_upload')

    def __eq__(self, other):
        return isinstance(other, UploadValidator) and other.kind == self.kind


def check_upload(upload, kind='document', field='file'):
    """For views reading request.FILES directly: raise a 400 if `upload` is refused."""
    problem = upload_problem(upload, kind)
    if problem:
        from rest_framework.exceptions import ValidationError as DRFValidationError
        raise DRFValidationError({field: [problem]})
