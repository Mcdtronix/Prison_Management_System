import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Prison_Management_System.settings')
django.setup()

from django.contrib.auth.models import User
from Auth.utils import get_primary_assignment

for user in User.objects.all():
    assignment = get_primary_assignment(user)
    try:
        profile = user.userprofile
        print(f"User: {user.username}, Role: {profile.role.code}, Station: {profile.station.code}")
    except:
        print(f"User: {user.username}, No profile")
    
    if assignment:
        print(f"  Assignment: Org: {assignment.org_unit}, Dept: {assignment.department}")
    else:
        print("  No primary assignment.")
