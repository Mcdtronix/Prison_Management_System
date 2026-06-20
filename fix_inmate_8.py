import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Prison_Management_System.settings')
django.setup()

from Reception.models import Inmate, Convicted, Restitution, ReleaseHistory, calculate_inmate_release_dates

try:
    inmate = Inmate.objects.get(id=8)
    print(f"Found Inmate {inmate.prison_number}")
    
    # Check Restitutions
    restitutions = Restitution.objects.filter(inmate=inmate)
    for r in restitutions:
        print(f"Restitution ID: {r.id}, Amount: {r.restitution_amount}")
        print(f"  Sentence DB: {r.restitution_sentence_years}Y {r.restitution_sentence_months}M {r.restitution_sentence_days}D")
        
        # If it's missing the 3 months, update it
        if r.restitution_sentence_months == 0 and r.restitution_sentence_years == 0 and r.restitution_sentence_days == 0:
            print("  Fixing missing 3 months restitution...")
            r.restitution_sentence_months = 3
            r.save()
            
    # Recalculate ReleaseHistory
    calculate_inmate_release_dates(inmate)
    
    rh = ReleaseHistory.objects.get(inmate=inmate)
    print(f"ReleaseHistory Updated:")
    print(f"  Total Days: {rh.total_sentences_days}, Remission: {rh.total_remission_days}")
    print(f"  Standard EDR: {rh.edr_standard}, Standard ODR: {rh.odr_standard}")
    print(f"  Restitution EDR: {rh.edr_restitution_paid}, Restitution ODR: {rh.odr_restitution_paid}")
    
except Exception as e:
    print(f"Error: {e}")

