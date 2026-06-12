from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.urls import reverse
from Auth.models import OrgUnit, Department, OrgUnitDepartment, UserAssignment, Role
from Messaging.models import Mailbox, Thread, Message
from django.core.files.uploadedfile import SimpleUploadedFile


class MessagingFlowTest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user(username='alice', password='pass')
        self.user_b = User.objects.create_user(username='bob', password='pass')

        # Org hierarchy
        self.nat = OrgUnit.objects.create(code='NAT', name='National', code_short='NAT', unit_type='NATIONAL_HQ')
        self.prov = OrgUnit.objects.create(code='PROV', name='Prov', code_short='PROV', unit_type='PROVINCIAL_HQ', parent=self.nat)
        self.stn = OrgUnit.objects.create(code='STN', name='Station', code_short='STN', unit_type='STATION', parent=self.prov)

        # Department and mailbox setups
        self.dept = Department.objects.create(code='RECEPTION', name='Reception')
        self.oud_a = OrgUnitDepartment.objects.create(org_unit=self.stn, department=self.dept, mailbox_address='reception@stn.example')
        self.mailbox_a = Mailbox.objects.create(org_unit_department=self.oud_a, mailbox_address=self.oud_a.mailbox_address)

        # Another mailbox (recipient)
        self.oud_b = OrgUnitDepartment.objects.create(org_unit=self.prov, department=self.dept, mailbox_address='reception@prov.example')
        self.mailbox_b = Mailbox.objects.create(org_unit_department=self.oud_b, mailbox_address=self.oud_b.mailbox_address)

        # Roles and assignments
        role = Role.objects.create(code='RECEPTION_OFFICER', name='Reception')
        UserAssignment.objects.create(user=self.user_a, role=role, org_unit=self.stn, department=self.dept, is_primary=True, is_active=True)
        UserAssignment.objects.create(user=self.user_b, role=role, org_unit=self.prov, department=self.dept, is_primary=True, is_active=True)

        self.client = APIClient()

    def test_send_and_read_flow(self):
        # Login as alice
        # Use force_authenticate / force_login to satisfy JWT-only auth in tests
        self.client.force_login(self.user_a)

        # Create thread addressed to reception@prov.example
        threads_url = '/api/messaging/threads/'
        payload = {'subject': 'Test Thread', 'participants': [self.mailbox_b.mailbox_address]}
        resp = self.client.post(threads_url, payload)
        self.assertEqual(resp.status_code, 201)
        thread_id = resp.json().get('id')

        # Post a message in the thread
        msgs_url = '/api/messaging/messages/'
        resp = self.client.post(msgs_url, {'thread': thread_id, 'body': 'Hello from A'})
        self.assertEqual(resp.status_code, 201)

        # Login as bob and fetch thread (should mark read)
        self.client.force_login(self.user_b)
        resp = self.client.get(f'/api/messaging/threads/{thread_id}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('messages', data)
        # Verify that messages include read_by info via participants' mailbox
        msg = data['messages'][0]
        # Fetch message from DB and assert mailbox_b in read_by
        db_msg = Message.objects.get(id=msg['id'])
        self.assertIn(self.mailbox_b, list(db_msg.read_by.all()))

    def test_thread_with_attachment(self):
        self.client.force_login(self.user_a)
        threads_url = '/api/messaging/threads/'

        # Prepare a small uploaded file
        small_file = SimpleUploadedFile('test.txt', b'hello world', content_type='text/plain')

        data = {
            'subject': 'With Attachment',
            'participants': [self.mailbox_b.mailbox_address],
            'initial_body': 'Please see attached'
        }

        # Post as multipart/form-data including files
        resp = self.client.post(threads_url, data, format='multipart', files={'attachments': small_file})
        self.assertEqual(resp.status_code, 201)
        json = resp.json()
        self.assertIn('initial_message', json)
        msg_id = json['initial_message']['id']
        db_msg = Message.objects.get(id=msg_id)
        self.assertEqual(db_msg.attachments.count(), 1)
