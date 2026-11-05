"""Messaging API: everyday use, access control, formatting, files, drafts,
signatures, grammar and the data migration.

Every client signs in through /api/auth/login/ and sends the JWT, the same way
the app does, so the org and mailbox middleware run exactly as in production.
Uploaded files go to a temporary folder, never to the real media folder.
"""
import io
import json
import shutil
import tempfile
from unittest import mock
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from Auth.models import Department, OrgUnit, OrgUnitDepartment
from Auth.testing import assign, role
from Messaging.models import Draft, InlineImage, Message, Thread, ThreadParticipant

User = get_user_model()
PW = 'Kx9!vTq2#mLw7pZ'
THREADS = '/api/messaging/threads/'
MESSAGES = '/api/messaging/messages/'
DRAFTS = '/api/messaging/drafts/'


def rows(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


def pdf(name='report.pdf', size=32):
    return SimpleUploadedFile(name, b'%PDF-1.4' + b'0' * size, content_type='application/pdf')


def png(name='photo.png'):
    buf = io.BytesIO()
    Image.new('RGB', (4, 4), 'green').save(buf, 'PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


def path_of(url):
    """Signed links are absolute; the test client wants path + query."""
    parsed = urlparse(url)
    return f'{parsed.path}?{parsed.query}'


class TempMediaMixin:
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp(prefix='pms-test-media-')
        cls._media_override = override_settings(MEDIA_ROOT=cls._media, MESSAGING_X_ACCEL_REDIRECT=False)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()


class MessagingBase(TempMediaMixin, TestCase):
    """Two provinces, one station in each.

    alice   reception @ station S1 (province P1)
    phealth health    @ province P1
    mallory reception @ station S2 (province P2) - outside alice's conversations
    """

    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.p1 = OrgUnit.objects.create(code='P1', name='Province 1', code_short='P1', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.p2 = OrgUnit.objects.create(code='P2', name='Province 2', code_short='P2', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.s1 = OrgUnit.objects.create(code='S1', name='Station 1', code_short='S1', unit_type='STATION', parent=self.p1)
        self.s2 = OrgUnit.objects.create(code='S2', name='Station 2', code_short='S2', unit_type='STATION', parent=self.p2)
        self.reception = Department.objects.get(code='RECEPTION')
        self.health = Department.objects.get(code='HEALTH')

        self.alice = self.make('1000001A', 'RECEPTION_OFFICER', self.s1, first='Alice', last='Moyo')
        self.phealth = self.make('1000002B', 'HEALTH_OFFICER', self.p1)
        self.mallory = self.make('1000003C', 'RECEPTION_OFFICER', self.s2)

        self.rec_s1 = self.mailbox(self.s1, self.reception)
        self.health_p1 = self.mailbox(self.p1, self.health)
        self.rec_s2 = self.mailbox(self.s2, self.reception)

        self.a = self.signed_in(self.alice)
        self.ph = self.signed_in(self.phealth)
        self.m = self.signed_in(self.mallory)

    def make(self, username, role_code, unit, first='Test', last='Officer'):
        user = User.objects.create_user(username=username, password=PW, first_name=first, last_name=last)
        assign(user, role(role_code), unit)
        return user

    def mailbox(self, unit, dept):
        oud = OrgUnitDepartment.objects.get_or_create(org_unit=unit, department=dept)[0]
        return oud.mailbox  # created automatically with the department

    def signed_in(self, user):
        client = APIClient()
        r = client.post('/api/auth/login/', {'username': user.username, 'password': PW}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        return client

    def start(self, client=None, to=None, body='Hello', **extra):
        """Start a conversation (alice -> province health by default) with a plain body."""
        client = client or self.a
        to = to if to is not None else self.health_p1.mailbox_address
        return client.post(THREADS, {'subject': extra.pop('subject', 'Transfer'), 'participants': to,
                                     'initial_body': body, **extra}, format='multipart')

    def reply(self, client, thread_id, **fields):
        return client.post(MESSAGES, {'thread': thread_id, **fields}, format='multipart')

    def folder(self, client, name='inbox', **params):
        r = client.get(THREADS, {'folder': name, **params})
        self.assertEqual(r.status_code, 200, r.content)
        return rows(r)

    def ids(self, client, name='inbox', **params):
        return [t['id'] for t in self.folder(client, name, **params)]


# ======================================================================= everyday use

class ConversationTests(MessagingBase):
    def test_send_open_and_reply(self):
        r = self.start(body='Inmate 123 arriving Monday')
        self.assertEqual(r.status_code, 201, r.content)
        thread_id = r.json()['id']
        first = r.json()['initial_message']
        self.assertEqual(first['sender']['address'], self.rec_s1.mailbox_address)
        self.assertEqual(first['sender']['unit'], 'Station 1')
        self.assertEqual(first['sent_by_name'], 'Alice Moyo')

        inbox = self.folder(self.ph)
        self.assertEqual([t['id'] for t in inbox], [thread_id])
        self.assertEqual(inbox[0]['unread_count'], 1)
        self.assertEqual(inbox[0]['snippet'], 'Inmate 123 arriving Monday')
        self.assertEqual(inbox[0]['last_sender']['department'], self.reception.name)

        r = self.ph.get(f'{THREADS}{thread_id}/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.folder(self.ph)[0]['unread_count'], 0)

        r = self.reply(self.ph, thread_id, body='Noted')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertFalse(r.json()['is_mine'] is False)  # the replier's own message
        bodies = [m['body'] for m in self.a.get(f'{THREADS}{thread_id}/').json()['messages']]
        self.assertEqual(bodies, ['Inmate 123 arriving Monday', 'Noted'])

    def test_folders(self):
        thread_id = self.start().json()['id']
        # Sender: in Sent, not in Inbox until someone else writes.
        self.assertEqual(self.ids(self.a, 'sent'), [thread_id])
        self.assertEqual(self.ids(self.a, 'inbox'), [])
        self.reply(self.ph, thread_id, body='Reply')
        self.assertEqual(self.ids(self.a, 'inbox'), [thread_id])

        url = f'{THREADS}{thread_id}/state/'
        self.ph.post(url, {'starred': True}, format='json')
        self.assertEqual(self.ids(self.ph, 'starred'), [thread_id])
        self.assertEqual(self.ids(self.a, 'starred'), [])  # stars are per mailbox

        self.ph.post(url, {'archived': True}, format='json')
        self.assertEqual(self.ids(self.ph, 'inbox'), [])
        self.assertEqual(self.ids(self.ph, 'archived'), [thread_id])

        self.ph.post(url, {'trashed': True}, format='json')
        self.assertEqual(self.ids(self.ph, 'archived'), [])
        self.assertEqual(self.ids(self.ph, 'trash'), [thread_id])
        self.assertEqual(self.ids(self.a, 'inbox'), [thread_id])  # untouched for alice
        self.assertTrue(Thread.objects.filter(pk=thread_id).exists())  # nothing deleted

        # New activity brings it back to the inbox.
        self.reply(self.a, thread_id, body='Following up')
        self.assertEqual(self.ids(self.ph, 'inbox'), [thread_id])

    def test_unread_counts_and_mark_unread(self):
        thread_id = self.start().json()['id']
        self.reply(self.a, thread_id, body='second')
        self.assertEqual(self.ph.get('/api/messaging/unread_count/').json()['count'], 2)
        self.assertEqual(self.a.get('/api/messaging/unread_count/').json()['count'], 0)
        self.ph.get(f'{THREADS}{thread_id}/')
        self.assertEqual(self.ph.get('/api/messaging/unread_count/').json()['count'], 0)
        self.ph.post(f'{THREADS}{thread_id}/state/', {'read': False}, format='json')
        self.assertEqual(self.ph.get('/api/messaging/unread_count/').json()['count'], 2)
        self.ph.post(f'{THREADS}{thread_id}/state/', {'trashed': True}, format='json')
        self.assertEqual(self.ph.get('/api/messaging/unread_count/').json()['count'], 0)

    def test_peek_without_marking_read(self):
        thread_id = self.start().json()['id']
        self.ph.get(f'{THREADS}{thread_id}/?mark_read=0')
        self.assertEqual(self.folder(self.ph)[0]['unread_count'], 1)

    def test_bulk_state(self):
        t1 = self.start(subject='One').json()['id']
        t2 = self.start(subject='Two').json()['id']
        r = self.ph.post(f'{THREADS}state/', {'ids': [t1, t2, 999999], 'archived': True}, format='json')
        self.assertEqual(r.json()['updated'], 2)
        self.assertEqual(set(self.ids(self.ph, 'archived')), {t1, t2})
        self.assertEqual(self.ph.post(f'{THREADS}state/', {'ids': [t1]}, format='json').status_code, 400)

    def test_inbox_newest_activity_first_and_search(self):
        old = self.start(subject='Old transfer', body='Kit list').json()['id']
        new = self.start(subject='New audit', body='Bring the ledger').json()['id']
        self.assertEqual(self.ids(self.ph), [new, old])
        self.reply(self.a, old, body='Bump')
        self.assertEqual(self.ids(self.ph), [old, new])
        self.assertEqual(self.ids(self.ph, q='audit'), [new])
        self.assertEqual(self.ids(self.ph, q='ledger'), [new])  # message text too

    def test_bad_folder(self):
        self.assertEqual(self.ph.get(THREADS, {'folder': 'spam'}).status_code, 400)

    def test_station_sees_conversation_started_by_its_province(self):
        r = self.start(client=self.ph, to=self.rec_s1.mailbox_address, body='Audit on Friday')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.ids(self.a), [r.json()['id']])

    def test_subject_required(self):
        self.assertEqual(self.start(subject='  ').status_code, 400)


# ======================================================================= access control

class AccessTests(MessagingBase):
    """An officer outside a conversation can't see, change or join it."""

    def setUp(self):
        super().setUp()
        r = self.start(body='SECRET medical details', attachments=pdf())
        self.thread_id = r.json()['id']
        self.msg_id = r.json()['initial_message']['id']
        self.attachment_url = r.json()['initial_message']['attachments'][0]['url']

    def test_outsider_sees_nothing(self):
        self.assertEqual(rows(self.m.get(MESSAGES)), [])
        for name in ('inbox', 'sent', 'starred', 'archived', 'trash'):
            self.assertEqual(self.folder(self.m, name), [], name)
        self.assertEqual(self.m.get(f'{THREADS}{self.thread_id}/').status_code, 404)
        self.assertEqual(self.m.get(f'{MESSAGES}{self.msg_id}/').status_code, 404)
        self.assertEqual(self.m.post(f'{THREADS}{self.thread_id}/state/', {'starred': True}, format='json').status_code, 404)
        self.assertEqual(self.m.post(f'{THREADS}state/', {'ids': [self.thread_id], 'trashed': True}, format='json').json()['updated'], 0)

    def test_outsider_cannot_reply(self):
        self.assertEqual(self.reply(self.m, self.thread_id, body='butting in').status_code, 403)

    def test_nobody_can_edit_or_delete(self):
        for client in (self.m, self.a):
            self.assertEqual(client.patch(f'{MESSAGES}{self.msg_id}/', {'body': 'X'}, format='json').status_code, 405)
            self.assertEqual(client.delete(f'{MESSAGES}{self.msg_id}/').status_code, 405)
            self.assertEqual(client.patch(f'{THREADS}{self.thread_id}/', {'subject': 'x'}, format='json').status_code, 405)
            self.assertEqual(client.delete(f'{THREADS}{self.thread_id}/').status_code, 405)
        self.assertEqual(Message.objects.get(id=self.msg_id).body, 'SECRET medical details')

    def test_sender_cannot_be_spoofed(self):
        r = self.reply(self.a, self.thread_id, body='Hi', sender=self.health_p1.id)
        self.assertEqual(Message.objects.get(id=r.json()['id']).sender, self.rec_s1)

    def test_download_links(self):
        r = self.a.get(path_of(self.attachment_url))
        self.assertEqual(r.status_code, 200)
        self.assertIn('attachment; filename="report.pdf"', r['Content-Disposition'])
        self.assertEqual(b''.join(r.streaming_content)[:8], b'%PDF-1.4')
        # Links need no login token (the browser follows them directly)...
        self.assertEqual(APIClient().get(path_of(self.attachment_url)).status_code, 200)
        # ...but cannot be altered or reused for another file.
        self.assertEqual(self.a.get(path_of(self.attachment_url).replace('t=', 't=x')).status_code, 404)
        other = path_of(self.attachment_url).replace(f'/attachment/', '/inline/')
        self.assertEqual(self.a.get(other).status_code, 404)
        self.assertEqual(self.a.get('/api/messaging/files/attachment/1/').status_code, 404)

    def test_link_stops_working_when_mailbox_leaves(self):
        ThreadParticipant.objects.filter(thread_id=self.thread_id, mailbox=self.rec_s1).delete()
        self.assertEqual(self.a.get(path_of(self.attachment_url)).status_code, 404)

    def test_link_expires(self):
        with mock.patch('Messaging.files.FILE_LINK_MAX_AGE', -1):
            self.assertEqual(self.a.get(path_of(self.attachment_url)).status_code, 404)

    @override_settings(MESSAGING_X_ACCEL_REDIRECT=True)
    def test_production_hands_file_to_nginx(self):
        r = self.a.get(path_of(self.attachment_url))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r['X-Accel-Redirect'].startswith('/media/messaging/attachments/'))
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')

    def test_assignment_removed_while_signed_in(self):
        loner = self.make('1000009Z', 'RECEPTION_OFFICER', self.s1)
        c = self.signed_in(loner)
        loner.org_assignments.update(is_active=False)  # no assignment -> no mailbox
        self.assertEqual(self.folder(c), [])
        self.assertEqual(self.start(client=c).status_code, 403)


# ======================================================================= recipients and directory

class RecipientTests(MessagingBase):
    def test_unknown_address_is_refused_and_nothing_is_created(self):
        before = OrgUnitDepartment.objects.count()
        self.assertEqual(self.start(to='farms@p2.pms.local').status_code, 400)
        self.assertEqual(OrgUnitDepartment.objects.count(), before)
        self.assertFalse(Thread.objects.exists())

    def test_anyone_can_message_anyone(self):
        r = self.start(to=f'{self.rec_s2.mailbox_address},{self.health_p1.mailbox_address}')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.ids(self.m), [r.json()['id']])
        self.assertEqual(self.start(client=self.ph, to=self.rec_s2.mailbox_address).status_code, 201)

    def test_one_bad_recipient_blocks_the_whole_send(self):
        self.assertEqual(self.start(to=f'{self.health_p1.mailbox_address},nobody@nowhere.pms.local').status_code, 400)
        self.assertFalse(Thread.objects.exists())

    def test_inactive_mailbox_is_refused(self):
        OrgUnitDepartment.objects.filter(pk=self.health_p1.org_unit_department_id).update(active=False)
        self.assertEqual(self.start().status_code, 400)

    def test_recipient_required(self):
        self.assertEqual(self.start(to='').status_code, 400)
        self.assertEqual(self.start(to=self.rec_s1.mailbox_address).status_code, 400)  # only yourself


class DirectoryTests(MessagingBase):
    def search(self, q=''):
        r = self.a.get('/api/messaging/mailboxes/', {'q': q} if q else {})
        self.assertEqual(r.status_code, 200)
        return {m['mailbox_address']: m for m in rows(r)}

    def test_lists_every_active_mailbox_with_names(self):
        entry = self.search()[self.health_p1.mailbox_address]
        self.assertEqual((entry['department_name'], entry['org_unit_name']), (self.health.name, 'Province 1'))

    def test_search_by_unit_department_or_both(self):
        self.assertEqual(set(self.search('Station 2')), {self.rec_s2.mailbox_address})
        self.assertEqual(set(self.search(f'{self.reception.name} Station 1')), {self.rec_s1.mailbox_address})

    def test_new_department_is_searchable_before_anyone_uses_it(self):
        oud = OrgUnitDepartment.objects.create(org_unit=self.s2, department=self.health)
        self.assertIn(oud.mailbox_address, self.search('Station 2'))

    def test_inactive_mailboxes_are_hidden(self):
        OrgUnit.objects.filter(pk=self.p1.pk).update(active=False)
        self.assertNotIn(self.health_p1.mailbox_address, self.search())


# ======================================================================= formatting

class FormattingTests(MessagingBase):
    def send_html(self, html, **extra):
        return self.a.post(THREADS, {'subject': 'Formatted', 'participants': self.health_p1.mailbox_address,
                                     'body_html': html, **extra}, format='multipart')

    def test_formatting_is_kept_and_danger_removed(self):
        r = self.send_html('<p>Please <strong>bring</strong> <span style="color:#c00;position:fixed">this</span>'
                           '<script>alert(1)</script><img src=x onerror=alert(2)></p>'
                           '<a href="javascript:alert(3)">x</a><ul><li>Kit</li></ul>', importance='HIGH')
        self.assertEqual(r.status_code, 201, r.content)
        msg = Message.objects.get(id=r.json()['initial_message']['id'])
        self.assertIn('<strong>bring</strong>', msg.body_html)
        self.assertIn('style="color:#c00"', msg.body_html)
        for bad in ('script', 'onerror', 'javascript:', 'position', '<img'):
            self.assertNotIn(bad, msg.body_html)
        self.assertEqual(msg.body, 'Please bring this\nx\nKit')
        self.assertEqual(msg.importance, 'HIGH')
        self.assertTrue(self.folder(self.ph)[0]['important'])

    def test_plain_messages_render_as_html(self):
        thread_id = self.start(body='Line one\nLine <two>').json()['id']
        html = self.ph.get(f'{THREADS}{thread_id}/').json()['messages'][0]['body_html']
        self.assertEqual(html, '<p>Line one<br>Line &lt;two&gt;</p>')

    def test_bad_importance(self):
        self.assertEqual(self.send_html('<p>x</p>', importance='URGENT').status_code, 400)

    def test_pictures_inside_a_message(self):
        r = self.a.post('/api/messaging/inline-images/', {'file': png()}, format='multipart')
        self.assertEqual(r.status_code, 201, r.content)
        image_id, upload_url = r.json()['id'], r.json()['url']
        self.assertEqual(self.a.get(path_of(upload_url)).status_code, 200)  # uploader sees it before sending

        r = self.send_html(f'<p>Scene:</p><img src="{upload_url}" alt="cell">'
                           f'<img src="https://tracker.example/pixel.gif">')
        msg = Message.objects.get(id=r.json()['initial_message']['id'])
        self.assertEqual(msg.body_html.count('<img'), 1)
        self.assertIn(f'inline:{image_id}', msg.body_html)
        self.assertEqual(InlineImage.objects.get(id=image_id).message, msg)

        html = self.ph.get(f'{THREADS}{r.json()["id"]}/').json()['messages'][0]['body_html']
        url = html.split('src="')[1].split('"')[0].replace('&amp;', '&')
        response = self.ph.get(path_of(url))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response['Content-Disposition'].startswith('inline'))

    def test_only_real_pictures_are_accepted(self):
        fake = SimpleUploadedFile('photo.png', b'not really a png', content_type='image/png')
        self.assertEqual(self.a.post('/api/messaging/inline-images/', {'file': fake}, format='multipart').status_code, 400)
        self.assertEqual(self.a.post('/api/messaging/inline-images/', {'file': pdf()}, format='multipart').status_code, 400)


class AttachmentTests(MessagingBase):
    def test_attachment_is_saved_with_its_details(self):
        r = self.start(attachments=pdf('Warrant 12.pdf'))
        self.assertEqual(r.status_code, 201, r.content)
        att = r.json()['initial_message']['attachments'][0]
        self.assertEqual((att['name'], att['size'], att['content_type']), ('Warrant 12.pdf', 40, 'application/pdf'))
        self.assertTrue(self.folder(self.ph)[0]['has_attachments'])

    def test_reply_with_only_an_attachment(self):
        thread_id = self.start().json()['id']
        self.assertEqual(self.reply(self.ph, thread_id, attachments=pdf()).status_code, 201)
        self.assertEqual(self.reply(self.ph, thread_id, body=' ').status_code, 400)

    def test_disallowed_type(self):
        bad = SimpleUploadedFile('tool.exe', b'MZ', content_type='application/octet-stream')
        r = self.start(attachments=bad)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Thread.objects.exists())

    @override_settings(MESSAGING_MAX_ATTACHMENT_BYTES=16)
    def test_too_large(self):
        self.assertEqual(self.start(attachments=pdf(size=100)).status_code, 400)

    @override_settings(MESSAGING_MAX_ATTACHMENTS=1)
    def test_too_many(self):
        self.assertEqual(self.start(attachments=[pdf('a.pdf'), pdf('b.pdf')]).status_code, 400)


# ======================================================================= drafts, signature, config, grammar

class DraftTests(MessagingBase):
    def test_save_edit_and_send_a_draft(self):
        r = self.a.post(DRAFTS, {'subject': 'Later', 'recipients': [self.health_p1.mailbox_address],
                                 'body_html': '<p>Half <em>done</em><script>x</script></p>'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        draft_id = r.json()['id']
        self.assertEqual(r.json()['body_html'], '<p>Half <em>done</em></p>')
        self.assertEqual(r.json()['recipients'], [self.health_p1.mailbox_address])

        self.a.patch(f'{DRAFTS}{draft_id}/', {'subject': 'Ready'}, format='json')
        self.assertEqual([d['subject'] for d in rows(self.a.get(DRAFTS))], ['Ready'])

        self.assertEqual(rows(self.m.get(DRAFTS)), [])  # private to the mailbox
        self.assertEqual(self.m.get(f'{DRAFTS}{draft_id}/').status_code, 404)
        self.assertEqual(self.m.delete(f'{DRAFTS}{draft_id}/').status_code, 404)

        self.start(draft_id=draft_id)
        self.assertFalse(Draft.objects.exists())

    def test_drafts_can_be_discarded(self):
        draft_id = self.a.post(DRAFTS, {'subject': 'x'}, format='json').json()['id']
        self.assertEqual(self.a.delete(f'{DRAFTS}{draft_id}/').status_code, 204)


class SignatureConfigGrammarTests(MessagingBase):
    def test_signature(self):
        self.assertEqual(self.a.get('/api/messaging/signature/').json()['body_html'], '')
        r = self.a.put('/api/messaging/signature/', {'body_html': '<p><strong>A. Moyo</strong><br>Reception, Station 1'
                                                                  '<script>x</script></p>', 'auto_insert': False},
                       format='json')
        self.assertEqual(r.status_code, 200, r.content)
        data = self.a.get('/api/messaging/signature/').json()
        self.assertEqual(data['body_html'], '<p><strong>A. Moyo</strong><br>Reception, Station 1</p>')
        self.assertFalse(data['auto_insert'])
        self.assertEqual(self.ph.get('/api/messaging/signature/').json()['body_html'], '')  # per officer

    def test_config(self):
        data = self.a.get('/api/messaging/config/').json()
        self.assertEqual(data['mailbox']['address'], self.rec_s1.mailbox_address)
        self.assertIn('pdf', data['allowed_extensions'])
        self.assertFalse(data['grammar_enabled'])

    def test_grammar_not_set_up(self):
        self.assertEqual(self.a.post('/api/messaging/grammar/', {'text': 'Their is'}, format='json').status_code, 503)

    @override_settings(LANGUAGETOOL_URL='http://127.0.0.1:8081')
    def test_grammar_uses_local_server(self):
        reply = {'matches': [{'offset': 0, 'length': 5, 'message': 'Did you mean "There"?',
                              'replacements': [{'value': 'There'}], 'rule': {'category': {'name': 'Grammar'}}}]}
        fake = mock.MagicMock()
        fake.__enter__.return_value = io.BytesIO(json.dumps(reply).encode())
        with mock.patch('Messaging.views.urllib.request.urlopen', return_value=fake) as urlopen:
            r = self.a.post('/api/messaging/grammar/', {'text': 'Their is a problem'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['matches'][0]['replacements'], ['There'])
        self.assertTrue(urlopen.call_args[0][0].full_url.startswith('http://127.0.0.1:8081/'))
        self.assertTrue(self.a.get('/api/messaging/config/').json()['grammar_enabled'])

    @override_settings(LANGUAGETOOL_URL='http://127.0.0.1:8081')
    def test_grammar_server_down(self):
        import urllib.error
        with mock.patch('Messaging.views.urllib.request.urlopen', side_effect=urllib.error.URLError('refused')):
            r = self.a.post('/api/messaging/grammar/', {'text': 'Hello'}, format='json')
        self.assertEqual(r.status_code, 502)


# ======================================================================= migration

class MigrationCarryOverTest(TransactionTestCase):
    """0004 keeps each mailbox's read status, inbox order and file details."""
    before = [('Messaging', '0003_backfill_mailboxes')]
    after = [('Messaging', '0004_message_model_v2')]

    def test_read_status_and_order_survive(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.before)
        apps = executor.loader.project_state(self.before).apps
        OrgUnit = apps.get_model('Auth', 'OrgUnit')
        Department = apps.get_model('Auth', 'Department')
        OUD = apps.get_model('Auth', 'OrgUnitDepartment')
        Mailbox = apps.get_model('Messaging', 'Mailbox')
        OldThread = apps.get_model('Messaging', 'Thread')
        OldParticipant = apps.get_model('Messaging', 'ThreadParticipant')
        OldMessage = apps.get_model('Messaging', 'Message')

        unit = OrgUnit.objects.create(code='MIG', name='Mig', code_short='MIG', unit_type='NATIONAL_HQ')
        dept = Department.objects.create(code='MIGDEPT', name='Mig dept')
        oud = OUD.objects.create(org_unit=unit, department=dept, mailbox_address='mig@pms.test')
        reader = Mailbox.objects.create(org_unit_department=oud, mailbox_address='mig@pms.test')
        thread = OldThread.objects.create(subject='Old')
        OldParticipant.objects.create(thread=thread, mailbox=reader)
        first = OldMessage.objects.create(thread=thread, body='one')
        OldMessage.objects.create(thread=thread, body='two')  # unread
        first.read_by.add(reader)

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(self.after)

        participant = ThreadParticipant.objects.get(thread_id=thread.pk)
        first = Message.objects.get(body='one')
        self.assertEqual(participant.last_read_at, first.created_at)
        newest = Message.objects.get(body='two').created_at
        self.assertEqual(Thread.objects.get(pk=thread.pk).last_message_at, newest)
