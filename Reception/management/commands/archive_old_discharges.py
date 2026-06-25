from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from Reception.models import Discharged, ArchivedDischarge
from django.db import transaction

class Command(BaseCommand):
    help = 'Archives discharge records older than 5 years (FIFO) to compress database tables.'

    def handle(self, *args, **options):
        # Calculate the cutoff date (5 years ago)
        cutoff_date = (timezone.now() - timedelta(days=5 * 365)).date()
        
        old_discharges = Discharged.objects.filter(discharge_date__lt=cutoff_date).select_related('offence', 'prison_number')
        
        count = old_discharges.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS(f'No discharge records older than {cutoff_date} to archive.'))
            return

        with transaction.atomic():
            for discharge in old_discharges:
                inmate = discharge.prison_number
                offence = discharge.offence
                
                # Compress related data into JSON format
                compressed_data = {
                    "inmate": {
                        "id": inmate.id if inmate else None,
                        "prison_number": inmate.prison_number if inmate else None,
                        "surname": inmate.surname if inmate else None,
                        "first_name": inmate.first_name if inmate else None,
                    },
                    "offence": {
                        "id": offence.id,
                        "description": offence.offence_description,
                        "court": offence.court,
                        "date_charged": str(offence.date_charged)
                    },
                    "discharge": {
                        "id": discharge.discharged_id,
                        "reason": discharge.discharge_reason,
                        "date": str(discharge.discharge_date),
                        "remarks": discharge.remarks
                    }
                }
                
                ArchivedDischarge.objects.create(
                    original_discharge_date=discharge.discharge_date,
                    inmate_prison_number=inmate.prison_number if inmate else "UNKNOWN",
                    offence_description=offence.offence_description,
                    discharge_reason=discharge.discharge_reason,
                    compressed_data=compressed_data
                )
                
                # Delete the hot record (Offence cascade deletes Discharged, CourtSessions, etc.)
                # This compresses the primary database tables.
                offence.delete()
                
            self.stdout.write(self.style.SUCCESS(f'Successfully archived and compressed {count} discharge records.'))
