from Reception.models import Inmate, Convicted, Restitution, SentenceGroup

inmate = Inmate.objects.get(id=8)
print(f"Inmate: {inmate.prison_number}")

groups = SentenceGroup.objects.filter(inmate=inmate)
for g in groups:
    print(f"SentenceGroup ID {g.id} - Duration: {g.duration_months} months")

