from Reception.models import Inmate
try:
    qs = Inmate.objects.prefetch_related(
        'next_of_kin',
        'classification_history',
        'station_history',
        'offences__conviction',
        'offences__unconviction',
        'property_history'
    )
    print("Prefetch result:", qs.filter(id=1).exists())
    list(qs.filter(id=1)) # force evaluation
    print("Evaluation successful")
except Exception as e:
    print("Exception:", str(e))
