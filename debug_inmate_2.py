import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Reception.models import CourtSession, Offence

offences = Offence.objects.filter(inmate__prison_number='0005/26')
for o in offences:
    print(f"Offence: {o.offence_description}")
    sessions = CourtSession.objects.filter(offence=o)
    print(f"Sessions: {sessions.count()}")
    for s in sessions:
        print(f"  Date: {s.session_date}, Outcome: {s.outcome}, Next Date: {s.next_court_date}")

