"""Upload checks (Core/uploads.py): security audit 2026-11-08, finding H2.

Before: only messaging checked uploads. Court warrants, receipts, inmate
photos and officer documents accepted any file type up to 100 MB, held in
memory. After: every upload must be an allowed type, within its size limit,
and really be that type, whichever screen or API path it arrives through.
"""
import io
import zipfile
from datetime import date

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image

from Core.uploads import UploadValidator, upload_problem
from HumanResources.models import Officer, OfficerDocument, OfficerStationHistory
from Messaging.files import check_attachments
from Reception.models import CourtSession, Restitution, RestitutionPayment
from Reception.tests_station_isolation import StationIsolationBase


# ---- genuine and disguised files

def pdf(name='warrant.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', 'application/pdf')


def picture(name='photo.png', fmt='PNG'):
    buf = io.BytesIO()
    Image.new('RGB', (8, 8), 'navy').save(buf, fmt)
    return SimpleUploadedFile(name, buf.getvalue(), f'image/{fmt.lower()}')


def office(name='letter.docx', folder='word/'):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        archive.writestr(f'{folder}document.xml', '<doc/>')
    return SimpleUploadedFile(name, buf.getvalue())


def disguised(name='warrant.pdf'):
    """A Windows program renamed to look like a document."""
    return SimpleUploadedFile(name, b'MZ\x90\x00' + b'\x00' * 64, 'application/pdf')


class UploadRulesTests(SimpleTestCase):
    def assertAccepted(self, upload, kind='document'):
        self.assertIsNone(upload_problem(upload, kind))

    def assertRefused(self, upload, kind='document', why=''):
        problem = upload_problem(upload, kind)
        self.assertIsNotNone(problem, f'{upload.name} should be refused')
        self.assertIn(why, problem)

    def test_genuine_documents_are_accepted(self):
        for upload in (pdf(), picture('scan.jpg', 'JPEG'), picture('scan.png'), office(),
                       office('register.xlsx', 'xl/'),
                       SimpleUploadedFile('old.doc', b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 32)):
            with self.subTest(upload.name):
                self.assertAccepted(upload)

    def test_renamed_programs_and_pages_are_refused(self):
        self.assertRefused(disguised('warrant.pdf'), why='not a genuine .pdf')
        self.assertRefused(SimpleUploadedFile('photo.jpg', b'<html><script>alert(1)</script>'),
                           why='not a genuine .jpg')
        self.assertRefused(SimpleUploadedFile('letter.docx', b'PK\x03\x04 not really a zip'),
                           why='not a genuine .docx')

    def test_a_plain_zip_is_not_a_word_document(self):
        self.assertRefused(office('letter.docx', folder='payload/'), why='not a genuine .docx')

    def test_damaged_picture_is_refused(self):
        self.assertRefused(SimpleUploadedFile('photo.png', b'\x89PNG\r\n\x1a\n' + b'garbage' * 20),
                           why='not a genuine .png')

    def test_dangerous_types_are_refused_by_name(self):
        for name in ('tool.exe', 'page.html', 'drawing.svg', 'script.js', 'archive.zip', 'noextension'):
            with self.subTest(name):
                self.assertRefused(SimpleUploadedFile(name, b'%PDF-1.4'), why='not an accepted type')

    def test_empty_file_is_refused(self):
        self.assertRefused(SimpleUploadedFile('blank.pdf', b''), why='empty')

    @override_settings(UPLOAD_MAX_DOCUMENT_BYTES=1024, UPLOAD_MAX_PHOTO_BYTES=512)
    def test_size_limits(self):
        big = SimpleUploadedFile('big.pdf', b'%PDF-1.4' + b'0' * 2048)
        self.assertRefused(big, why='the limit is')
        photo = picture()
        photo.size = 600
        self.assertRefused(photo, kind='photo', why='the limit is')

    def test_photos_must_be_pictures(self):
        self.assertAccepted(picture(), kind='photo')
        self.assertAccepted(picture('phone.webp', 'WEBP'), kind='photo')
        self.assertRefused(pdf('photo.pdf'), kind='photo', why='not an accepted type')

    def test_stored_files_are_not_rechecked(self):
        class Stored:
            _committed = True
        UploadValidator('document')(Stored())  # does not raise

    def test_validator_raises_a_field_error(self):
        with self.assertRaises(ValidationError):
            UploadValidator('document')(disguised())

    def test_messaging_attachments_check_contents_too(self):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        check_attachments([pdf('minutes.pdf')])
        with self.assertRaises(DRFValidationError):
            check_attachments([disguised('minutes.pdf')])


class UploadEndpointTests(StationIsolationBase):
    """Each upload path refuses a disguised file and keeps nothing."""

    def test_court_warrant(self):
        client = self.client_for(self.reception)
        before = CourtSession.objects.count()
        response = client.post('/api/reception/court-sessions/schedule/', {
            'offence_id': self.my_offence.id, 'next_court_date': '2026-12-20', 'warrant_document': disguised(),
        })
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('warrant_document', response.json())
        self.assertEqual(CourtSession.objects.count(), before)

        response = client.post('/api/reception/court-sessions/schedule/', {
            'offence_id': self.my_offence.id, 'next_court_date': '2026-12-20', 'warrant_document': pdf(),
        })
        self.assertEqual(response.status_code, 201, response.content)

    def test_restitution_receipt(self):
        restitution = Restitution.objects.create(offence=self.my_offence, inmate=self.mine,
                                                 restitution_amount=100, restitution_date=date(2026, 12, 1))
        response = self.client_for(self.reception).post(
            f'/api/reception/restitution/{restitution.id}/record_payment/',
            {'amount': '50', 'receipt_number': 'R-1', 'receipt': disguised('receipt.pdf')})
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(RestitutionPayment.objects.filter(restitution=restitution).exists())

    def test_inmate_photo(self):
        response = self.client_for(self.reception).patch(
            f'/api/reception/inmates/{self.mine.id}/', {'inmate_image': disguised('face.jpg')}, format='multipart')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('inmate_image', response.json())
        self.mine.refresh_from_db()
        self.assertFalse(self.mine.inmate_image)

    def test_officer_document(self):
        officer = Officer.objects.create(
            service_number='2300001A', first_name='First', surname='Doc', national_id='NI-2300001A',
            gender='Male', date_of_birth='1990-01-01', date_of_attestation='2015-01-01', current_status='ACTIVE')
        OfficerStationHistory.objects.create(officer=officer, station=self.chivhu_legacy,
                                             date_posted='2020-01-01', posted_by='HQ')
        client = self.client_for(self.admin)
        payload = {'officer': officer.pk, 'document_type': 'Appointment letter'}
        response = client.post('/api/hr/documents/', {**payload, 'file': disguised('letter.pdf')})
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(OfficerDocument.objects.exists())
        response = client.post('/api/hr/documents/', {**payload, 'file': pdf('letter.pdf')})
        self.assertEqual(response.status_code, 201, response.content)
