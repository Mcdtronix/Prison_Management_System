from Reception.models import Inmate, Convicted, Restitution

inmate = Inmate.objects.get(id=8)
print(f"Inmate: {inmate.prison_number}")

convictions = Convicted.objects.filter(prison_number=inmate)
for c in convictions:
    print(f"Convicted ID {c.id} - Offence: {c.offence.offence_description}")
    print(f"  Sentence DB: {c.sentence_years}Y {c.sentence_months}M {c.sentence_days}D")
    print(f"  Effective Days: {c.effective_sentence_days}")

