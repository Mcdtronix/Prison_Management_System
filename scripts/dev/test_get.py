import urllib.request
import json
from Auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

# Get any user
user = User.objects.first()
refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)

url = 'http://localhost:8000/api/reception/inmates/1/'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})

print(f"Requesting {url} with token...")
try:
    with urllib.request.urlopen(req) as response:
        print(f"Status: {response.status}")
        print(f"Response: {response.read().decode('utf-8')[:500]}")
except urllib.error.HTTPError as e:
    print(f"Status: {e.code}")
    print(f"Response: {e.read().decode('utf-8')[:500]}")
