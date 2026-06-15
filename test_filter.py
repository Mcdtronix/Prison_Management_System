from Reception.models import Inmate
from Core.filters import OrgUnitAccessFilterBackend

class DummyView:
    action = "retrieve"

filter_backend = OrgUnitAccessFilterBackend()
qs = filter_backend.filter_queryset(None, Inmate.objects.all(), DummyView())
print("Filter result:", qs.filter(id=1).exists())
