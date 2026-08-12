import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()
from Auth.models import OrgUnitDepartment
from Messaging.models import Mailbox
count = 0
for oud in OrgUnitDepartment.objects.all():
    if oud.org_unit.unit_type == 'NATIONAL_HQ':
        domain = "nat-hq.pms.local"
    else:
        domain = f"{oud.org_unit.code.lower().replace('_', '-')}.pms.local"
    
    canonical_addr = f"{oud.department.code.lower()}@{domain}"
    if oud.mailbox_address != canonical_addr:
        print(f"Updating {oud.mailbox_address} -> {canonical_addr}")
        oud.mailbox_address = canonical_addr
        oud.save(update_fields=['mailbox_address'])
        
        # update Mailbox if it exists
        mb = Mailbox.objects.filter(org_unit_department=oud).first()
        if mb:
            mb.mailbox_address = canonical_addr
            mb.save(update_fields=['mailbox_address'])
        count += 1
print(f"Fixed {count} records.")
