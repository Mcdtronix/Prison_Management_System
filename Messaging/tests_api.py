"""Messaging API: normal use, access control, recipient rules and attachments.

Every client signs in through /api/auth/login/ and sends the JWT, the same way
the app does, so the org and mailbox middleware run exactly as in production.
"""
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from Auth.models import Department, OrgUnit, OrgUnitDepartment
from Auth.testing import assign, role
from Messaging.models import Mailbox, Message, Thread
from Messaging.models_extra import Draft

User = get_user_model()
PW = 'Kx9!vTq2#mLw7pZ'
THREADS = '/api/messaging/threads/'
MESSAGES = '/api/messaging/messages/'


def rows(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


def pdf(name='report.pdf', size=32):
    return SimpleUploadedFile(name, b'%PDF-1.4' + b'0' * size, content_type='application/pdf')


class MessagingBase(TestCase):
    """Two provinces, one station in each.

    alice   reception @ station S1 (province P1)
    phealth health    @ province P1
    mallory reception @ station S2 (province P2) - unrelated to alice's conversations
    """

    def setUp(self):
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.p1 = OrgUnit.objects.create(code='P1', name='Province 1', code_short='P1', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.p2 = OrgUnit.objects.create(code='P2', name='Province 2', code_short='P2', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.s1 = OrgUnit.objects.create(code='S1', name='Station 1', code_short='S1', unit_type='STATION', parent=self.p1)
        self.s2 = OrgUnit.objects.create(code='S2', name='Station 2', code_short='S2', unit_type='STATION', parent=self.p2)
        self.reception = Department.objects.get(code='RECEPTION')
        self.health = Department.objects.get(code='HEALTH')

        self.alice = self.make('1000001A', 'RECEPTION_OFFICER', self.s1)
        self.phealth = self.make('1000002B', 'HEALTH_OFFICER', self.p1)
        self.mallory = self.make('1000003C', 'RECEPTION_OFFICER', self.s2)

        self.rec_s1 = self.mailbox(self.s1, self.reception)
        self.health_p1 = self.mailbox(self.p1, self.health)
        self.rec_s2 = self.mailbox(self.s2, self.reception)

        self.a = self.signed_in(self.alice)
        self.ph = self.signed_in(self.phealth)
        self.m = self.signed_in(self.mallory)

    def make(self, username, role_code, unit):
        user = User.objects.create_user(username=username, password=PW)
        assign(user, role(role_code), unit)
        return user

    def mailbox(self, unit, dept):
        oud = OrgUnitDepartment.objects.get_or_create(org_unit=unit, department=dept)[0]
        return Mailbox.objects.get_or_create(org_unit_department=oud, defaults={'mailbox_address': oud.mailbox_address})[0]

    def signed_in(self, user):
        client = APIClient()
        r = client.post('/api/auth/login/', {'username': user.username, 'password': PW}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        return client

    def start(self, client=None, to=None, body='Hello', **extra):
        """Start a conversation (alice -> province health by default)."""
        client = client or self.a
        to = to if to is not None else self.health_p1.mailbox_address
        return client.post(THREADS, {'subject': 'Transfer', 'participants': to, 'initial_body': body, **extra},
                           format='multipart')


class FlowTests(MessagingBase):
    def test_send_open_and_reply(self):
        r = self.start(body='Inmate 123 arriving Monday')
        self.assertEqual(r.status_code, 201, r.content)
        thread_id = r.json()['id']
        self.assertEqual(r.json()['initial_message']['sender'], self.rec_s1.id)

        r = self.ph.get(THREADS)
        self.assertEqual([t['id'] for t in rows(r)], [thread_id])
        self.assertTrue(rows(r)[0]['is_unread'])

        r = self.ph.get(f'{THREADS}{thread_id}/')
        self.assertEqual(r.status_code, 200)
        self.assertIn(self.health_p1, Message.objects.get(thread_id=thread_id).read_by.all())

        # Province health is not on its own list of who it may *start* a
        # conversation with at a station's reception, but it may reply here.
        r = self.ph.post(MESSAGES, {'thread': thread_id, 'body': 'Noted'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        bodies = [m['body'] for m in rows(self.a.get(MESSAGES))]
        self.assertEqual(bodies, ['Inmate 123 arriving Monday', 'Noted'])

    def test_station_sees_conversation_started_by_its_province(self):
        # Used to fail: the org-area filter hid threads owned by a unit above the station.
        r = self.start(client=self.ph, to=self.rec_s1.mailbox_address, body='Audit on Friday')
        self.assertEqual(r.status_code, 201, r.content)
        thread_id = r.json()['id']
        self.assertEqual([t['id'] for t in rows(self.a.get(THREADS))], [thread_id])
        self.assertEqual(self.a.get(f'{THREADS}{thread_id}/').status_code, 200)

    def test_sent_folder_and_own_mailbox_views(self):
        self.start()
        self.assertEqual(len(rows(self.a.get(THREADS + '?folder=sent'))), 1)
        self.assertEqual(len(rows(self.ph.get(THREADS + '?folder=sent'))), 0)
        self.assertEqual(self.a.get(f'/api/messaging/mailboxes/{self.rec_s1.id}/inbox/').status_code, 200)
        r = self.a.post(f'/api/messaging/mailboxes/{self.rec_s1.id}/drafts/', {'subject': 'Later', 'body': 'x'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Draft.objects.get().mailbox, self.rec_s1)

    def test_sender_cannot_be_spoofed(self):
        thread_id = self.start().json()['id']
        r = self.a.post(MESSAGES, {'thread': thread_id, 'body': 'Hi', 'sender': self.health_p1.id}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Message.objects.get(id=r.json()['id']).sender, self.rec_s1)

    def test_unread_count(self):
        self.start()
        r = self.ph.get('/api/messaging/unread_count/')
        self.assertEqual(r.json()['count'], 1)


class AccessTests(MessagingBase):
    """An officer outside a conversation can't see, change or join it."""

    def setUp(self):
        super().setUp()
        self.thread_id = self.start(body='SECRET medical details').json()['id']
        self.msg_id = Message.objects.get(thread_id=self.thread_id).id

    def test_outsider_sees_nothing(self):
        self.assertEqual(rows(self.m.get(MESSAGES)), [])
        self.assertEqual(rows(self.m.get(THREADS)), [])
        self.assertEqual(self.m.get(f'{THREADS}{self.thread_id}/').status_code, 404)
        self.assertEqual(self.m.get(f'{MESSAGES}{self.msg_id}/').status_code, 404)

    def test_outsider_cannot_open_another_mailbox(self):
        for path in ('inbox', 'outbox', 'drafts'):
            r = self.m.get(f'/api/messaging/mailboxes/{self.rec_s1.id}/{path}/')
            self.assertEqual(r.status_code, 403, path)
        r = self.m.post(f'/api/messaging/mailboxes/{self.rec_s1.id}/drafts/', {'subject': 'planted'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Draft.objects.exists())

    def test_outsider_cannot_reply(self):
        r = self.m.post(MESSAGES, {'thread': self.thread_id, 'body': 'butting in'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_nobody_can_edit_or_delete(self):
        for client in (self.m, self.a):
            self.assertEqual(client.patch(f'{MESSAGES}{self.msg_id}/', {'body': 'TAMPERED'}, format='json').status_code, 405)
            self.assertEqual(client.delete(f'{MESSAGES}{self.msg_id}/').status_code, 405)
            self.assertEqual(client.patch(f'{THREADS}{self.thread_id}/', {'subject': 'x'}, format='json').status_code, 405)
            self.assertEqual(client.delete(f'{THREADS}{self.thread_id}/').status_code, 405)
        self.assertEqual(Message.objects.get(id=self.msg_id).body, 'SECRET medical details')

    def test_assignment_removed_while_signed_in(self):
        loner = self.make('1000009Z', 'RECEPTION_OFFICER', self.s1)
        c = self.signed_in(loner)
        loner.org_assignments.update(is_active=False)  # no assignment -> no mailbox
        self.assertEqual(rows(c.get(THREADS)), [])
        self.assertEqual(rows(c.get(MESSAGES)), [])
        self.assertEqual(self.start(client=c).status_code, 403)


class RecipientTests(MessagingBase):
    def test_unknown_address_is_refused_and_nothing_is_created(self):
        before = OrgUnitDepartment.objects.count()
        r = self.start(to='farms@p2.pms.local')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(OrgUnitDepartment.objects.count(), before)
        self.assertFalse(Thread.objects.exists())

    def test_anyone_can_message_anyone(self):
        # A station can write to a station in another province, and to several mailboxes at once.
        r = self.start(to=f'{self.rec_s2.mailbox_address},{self.health_p1.mailbox_address}')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(rows(self.m.get(THREADS))[0]['id'], r.json()['id'])
        # ...and a province can start a conversation with any station department.
        self.assertEqual(self.start(client=self.ph, to=self.rec_s2.mailbox_address).status_code, 201)

    def test_one_bad_recipient_blocks_the_whole_send(self):
        r = self.start(to=f'{self.health_p1.mailbox_address},nobody@nowhere.pms.local')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Thread.objects.exists())

    def test_inactive_mailbox_is_refused(self):
        OrgUnitDepartment.objects.filter(pk=self.health_p1.org_unit_department_id).update(active=False)
        self.assertEqual(self.start().status_code, 400)

    def test_recipient_required(self):
        self.assertEqual(self.start(to='').status_code, 400)
        self.assertEqual(self.start(to=self.rec_s1.mailbox_address).status_code, 400)  # only yourself

    def test_province_can_reach_its_own_departments(self):
        rec_p1 = self.mailbox(self.p1, self.reception)
        r = self.start(client=self.ph, to=rec_p1.mailbox_address)
        self.assertEqual(r.status_code, 201, r.content)


class DirectoryTests(MessagingBase):
    """The recipient search behind Compose."""

    def search(self, q=''):
        r = self.a.get('/api/messaging/mailboxes/', {'q': q} if q else {})
        self.assertEqual(r.status_code, 200)
        return {m['mailbox_address']: m for m in rows(r)}

    def test_lists_every_active_mailbox_with_names(self):
        found = self.search()
        self.assertEqual(set(found), {self.rec_s1.mailbox_address, self.health_p1.mailbox_address,
                                      self.rec_s2.mailbox_address})
        entry = found[self.health_p1.mailbox_address]
        self.assertEqual((entry['department_name'], entry['org_unit_name'], entry['unit_type']),
                         (self.health.name, 'Province 1', 'PROVINCIAL_HQ'))

    def test_search_by_unit_department_or_both(self):
        self.assertEqual(set(self.search('Station 2')), {self.rec_s2.mailbox_address})
        self.assertEqual(set(self.search(self.health.name)), {self.health_p1.mailbox_address})
        self.assertEqual(set(self.search(f'{self.reception.name} Station 1')), {self.rec_s1.mailbox_address})

    def test_new_department_is_searchable_before_anyone_uses_it(self):
        # Used to fail: a mailbox record only appeared after a sign-in or a first message.
        oud = OrgUnitDepartment.objects.create(org_unit=self.s2, department=self.health)
        self.assertIn(oud.mailbox_address, self.search('Station 2'))
        self.assertEqual(self.start(to=oud.mailbox_address).status_code, 201)

    def test_inactive_mailboxes_are_hidden(self):
        OrgUnitDepartment.objects.filter(pk=self.rec_s2.org_unit_department_id).update(active=False)
        self.assertNotIn(self.rec_s2.mailbox_address, self.search())
        OrgUnit.objects.filter(pk=self.p1.pk).update(active=False)
        self.assertNotIn(self.health_p1.mailbox_address, self.search())


class AttachmentTests(MessagingBase):
    def test_attachment_is_saved(self):
        r = self.start(attachments=pdf())
        self.assertEqual(r.status_code, 201, r.content)
        msg = Message.objects.get(id=r.json()['initial_message']['id'])
        self.assertEqual(msg.attachments.count(), 1)

    def test_reply_with_only_an_attachment(self):
        thread_id = self.start().json()['id']
        r = self.ph.post(MESSAGES, {'thread': thread_id, 'attachments': pdf()}, format='multipart')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.ph.post(MESSAGES, {'thread': thread_id, 'body': ' '}, format='json').status_code, 400)

    def test_disallowed_type(self):
        bad = SimpleUploadedFile('tool.exe', b'MZ', content_type='application/octet-stream')
        r = self.start(attachments=bad)
        self.assertEqual(r.status_code, 400)
        self.assertIn('tool.exe', str(r.json()))
        self.assertFalse(Thread.objects.exists())

    @override_settings(MESSAGING_MAX_ATTACHMENT_BYTES=16)
    def test_too_large(self):
        self.assertEqual(self.start(attachments=pdf(size=100)).status_code, 400)
        self.assertFalse(Thread.objects.exists())

    @override_settings(MESSAGING_MAX_ATTACHMENTS=1)
    def test_too_many(self):
        self.assertEqual(self.start(attachments=[pdf('a.pdf'), pdf('b.pdf')]).status_code, 400)
