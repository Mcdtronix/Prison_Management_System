"""
Mailbox Context Middleware
==========================
Provides messaging/mailbox context for inter-organizational communication.

This middleware sets up context for the messaging system, enabling departments
to send messages to other departments at different organizational levels.

Pattern:
    request.mailbox: OrgUnitDepartment instance for user's primary assignment
    request.message_recipients: Potential recipient OrgUnitDepartment entries

The messaging system uses mailbox_address as unique identifiers:
    - reception@chivhu: Reception dept @ Chivhu station
    - health@harare-prov: Health dept @ Harare province
    - stores@nat-hq: Stores dept @ National HQ
"""

import logging
from django.utils.deprecation import MiddlewareMixin
from Auth.models import OrgUnitDepartment

logger = logging.getLogger(__name__)


class MailboxContextMiddleware(MiddlewareMixin):
    """
    Middleware to provide messaging/mailbox context.
    
    Resolves the requesting user/department's mailbox address and
    identifies potential message recipients.
    """
    
    def process_request(self, request):
        """
        Attach mailbox context to request.
        """
        
        # Initialize mailbox context
        request.mailbox = None
        request.message_recipients = {}
        
        # Inject Superadmin fallback context
        is_super = False
        if hasattr(request, 'user') and request.user.is_authenticated:
            if getattr(request.user, 'is_superuser', False) or getattr(request, 'role', '') == 'SUPER_ADMIN':
                is_super = True
                
        # Skip if no org context (not authenticated or no assignment)
        if not hasattr(request, 'org_unit') or not request.org_unit:
            if is_super:
                from Auth.models import OrgUnit
                request.org_unit = OrgUnit.objects.filter(unit_type='NATIONAL_HQ').first()
                if not request.org_unit:
                    return None
            else:
                return None
        
        if not hasattr(request, 'department') or not request.department:
            if is_super:
                from Auth.models import Department
                request.department = Department.objects.filter(code='ADMINISTRATION').first()
                if not request.department:
                    return None
            else:
                return None
        
        try:
            # Get or create mailbox for user's org_unit/department
            mailbox = OrgUnitDepartment.objects.filter(
                org_unit=request.org_unit,
                department=request.department,
                active=True
            ).first()
            
            if not mailbox:
                mailbox = OrgUnitDepartment.objects.create(
                    org_unit=request.org_unit,
                    department=request.department,
                    active=True
                )
            
            if mailbox:
                # Ensure there is a Mailbox model record for the OrgUnitDepartment
                try:
                    from Messaging.models import Mailbox as MessagingMailbox
                    mb_obj, _ = MessagingMailbox.objects.get_or_create(
                        org_unit_department=mailbox,
                        defaults={'mailbox_address': mailbox.mailbox_address}
                    )
                    request.mailbox = mb_obj
                except Exception:
                    # If Messaging app not installed, fallback to OrgUnitDepartment object
                    request.mailbox = mailbox
                
                # Build recipient map: allowed message destinations
                request.message_recipients = self._build_recipient_map(
                    request.org_unit,
                    request.department
                )
                
                logger.debug(
                    f'Mailbox context set for {request.user.username}: '
                    f'{mailbox.mailbox_address}'
                )
        
        except Exception as e:
            logger.error(f'Error setting mailbox context: {str(e)}')
        
        return None
    
    def _build_recipient_map(self, org_unit, department):
        """
        Build map of potential message recipients based on org hierarchy.
        
        Returns dict of {mailbox_code: OrgUnitDepartment}
        
        Rules:
        - Station depts can message: peer stations, parent province, GHQ
        - Provincial depts can message: child stations, peer provinces, GHQ
        - National depts can message: all
        """
        
        recipients = {}
        
        try:
            if org_unit.unit_type == 'STATION':
                # Station can send to:
                # 1. Parent province's departments
                if org_unit.parent:
                    parent_mailboxes = OrgUnitDepartment.objects.filter(
                        org_unit=org_unit.parent,
                        active=True
                    )
                    for mailbox in parent_mailboxes:
                        recipients[mailbox.mailbox_address] = mailbox
                
                # 2. National HQ's departments
                national = org_unit.get_root()  # Get National HQ
                national_mailboxes = OrgUnitDepartment.objects.filter(
                    org_unit=national,
                    active=True
                )
                for mailbox in national_mailboxes:
                    recipients[mailbox.mailbox_address] = mailbox
                
                # 3. Peer stations (same province)
                if org_unit.parent:
                    peer_mailboxes = OrgUnitDepartment.objects.filter(
                        org_unit__parent=org_unit.parent,
                        department=department,
                        active=True
                    ).exclude(org_unit=org_unit)
                    for mailbox in peer_mailboxes:
                        recipients[mailbox.mailbox_address] = mailbox
                        
                # 4. Other departments at the SAME station
                same_station = OrgUnitDepartment.objects.filter(
                    org_unit=org_unit,
                    active=True
                )
                for mailbox in same_station:
                    recipients[mailbox.mailbox_address] = mailbox
            
            elif org_unit.unit_type == 'PROVINCIAL_HQ':
                # Province can send to:
                # 1. Child stations
                child_mailboxes = OrgUnitDepartment.objects.filter(
                    org_unit__parent=org_unit,
                    department=department,
                    active=True
                )
                for mailbox in child_mailboxes:
                    recipients[mailbox.mailbox_address] = mailbox
                
                # 2. National HQ's departments
                national = org_unit.parent
                national_mailboxes = OrgUnitDepartment.objects.filter(
                    org_unit=national,
                    active=True
                )
                for mailbox in national_mailboxes:
                    recipients[mailbox.mailbox_address] = mailbox
                
                # 3. Peer provinces
                peer_mailboxes = OrgUnitDepartment.objects.filter(
                    org_unit__parent=national,
                    department=department,
                    active=True,
                    unit_type='PROVINCIAL_HQ'
                ).exclude(org_unit=org_unit)
                for mailbox in peer_mailboxes:
                    recipients[mailbox.mailbox_address] = mailbox
                    
                # 4. Other departments at the SAME province
                same_province = OrgUnitDepartment.objects.filter(
                    org_unit=org_unit,
                    active=True
                )
                for mailbox in same_province:
                    recipients[mailbox.mailbox_address] = mailbox
            
            elif org_unit.unit_type == 'NATIONAL_HQ':
                # National can send to all
                all_mailboxes = OrgUnitDepartment.objects.filter(
                    department=department,
                    active=True
                )
                for mailbox in all_mailboxes:
                    recipients[mailbox.mailbox_address] = mailbox
        
        except Exception as e:
            logger.warning(f'Error building recipient map: {str(e)}')
        
        return recipients


# Helper method to add to OrgUnit model for hierarchy traversal
def get_root(org_unit):
    """
    Get the root (National HQ) org unit by traversing parent hierarchy.
    
    This can be added as a method to OrgUnit model:
        OrgUnit.get_root = get_root
    
    Or called directly: get_root(some_org_unit)
    """
    current = org_unit
    while current.parent is not None:
        current = current.parent
    return current


# Patch OrgUnit to add get_root method
try:
    from Auth.models import OrgUnit
    OrgUnit.get_root = get_root
except ImportError:
    pass
