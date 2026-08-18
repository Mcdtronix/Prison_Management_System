import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from Reception.models import Inmate
from django.db.models import Q

queryset = Inmate.objects.all()
queryset = queryset.filter(Q(offences__Offence_status='UNCONVICTED')).distinct()
queryset = queryset.prefetch_related('offences')

for inmate in queryset.iterator(chunk_size=100):
    print("Inmate:", inmate.id)
    print("Offences:", list(inmate.offences.all()))
    break

