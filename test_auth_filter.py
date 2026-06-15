from Reception.models import Inmate
from Auth.models import User
from Core.filters import OrgUnitAccessFilterBackend

class DummyRequest:
    def __init__(self, user):
        self.user = user
        self.visible_org_units = getattr(user, 'visible_org_units', None)

user = User.objects.first()
print("Testing with user:", user.username)
request = DummyRequest(user)
print("Visible org units:", request.visible_org_units)

filter_backend = OrgUnitAccessFilterBackend()
class DummyView:
    action = "retrieve"

qs = filter_backend.filter_queryset(request, Inmate.objects.all(), DummyView())
print("Exists with filter:", qs.filter(id=1).exists())
