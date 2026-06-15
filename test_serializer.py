from Reception.models import Inmate
from Reception.serializers import ComprehensiveInmateSerializer
try:
    inmate = Inmate.objects.get(id=1)
    data = ComprehensiveInmateSerializer(inmate).data
    print("Serialization successful! Keys:", data.keys())
except Exception as e:
    import traceback
    print("Serialization failed:")
    traceback.print_exc()
