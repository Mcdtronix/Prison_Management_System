import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Reception.models import Inmate, Convicted, Offence, CourtSession
from django.utils import timezone

inmate = Inmate.objects.filter(prison_number='0005/26').first()
if inmate:
    # 1. Fix the Convicted record
    c = Convicted.objects.filter(prison_number=inmate).first()
    if c:
        c.sentence_years = 1
        c.sentence_months = 0
        c.sentence_days = 0
        # save will automatically recalculate effective_sentence_days, remission, EDR/ODR
        c.save()
        print("Conviction record fixed.")
        
    # 2. Add a CourtSession to populate the timeline
    o = Offence.objects.filter(inmate=inmate).first()
    if o:
        if not CourtSession.objects.filter(offence=o).exists():
            cs = CourtSession(
                offence=o,
                session_date=o.date_charged,
                outcome='CONVICTED',
                remarks='Convicted at Chivhu court.'
            )
            cs.save()
            print("Court session added to timeline.")
            
    print("Done fixing 0005/26.")
