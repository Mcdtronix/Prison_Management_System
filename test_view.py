from Reception.views import InmateViewSet
from Auth.models import User
from rest_framework.request import Request
from django.test.client import RequestFactory

user = User.objects.first()
factory = RequestFactory()
django_request = factory.get('/api/reception/inmates/1/')
django_request.user = user

view = InmateViewSet()
view.request = Request(django_request)
view.action = 'retrieve'
view.kwargs = {'pk': '1'}

qs = view.filter_queryset(view.get_queryset())
print("Queryset filtered exists:", qs.filter(pk=1).exists())

try:
    obj = view.get_object()
    print("get_object succeeded:", obj)
except Exception as e:
    import traceback
    traceback.print_exc()
