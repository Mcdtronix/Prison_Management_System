# RBAC Setup Guide

Complete setup guide for Role-Based Access Control system.

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Initialize RBAC

```bash
python manage.py init_rbac
```

This creates:
- **Roles**: SUPER_ADMIN, ADMIN_OFFICER, RECEPTION_OFFICER, HEALTH_OFFICER, STORES_OFFICER, FARMS_OFFICER
- **Stations**: CHIKURUBI, HARARE, BULAWAYO, GWERU (examples)

### 4. Create Superuser

```bash
python manage.py createsuperuser
```

### 5. Assign Role and Station

1. Start Django server: `python manage.py runserver`
2. Go to: http://localhost:8000/admin/
3. Login with superuser credentials
4. Navigate to: **Users** → Select your user
5. Scroll to **Profile** section:
   - Select **Role** (e.g., SUPER_ADMIN)
   - Select **Station** (e.g., CHIKURUBI)
   - Check **Is active**
6. Save

### 6. Test Login

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

Expected response:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "role": "SUPER_ADMIN",
  "station_id": 1,
  "station_code": "CHIKURUBI",
  ...
}
```

## Creating Additional Users

### Via Django Admin

1. Go to **Users** → **Add user**
2. Enter username and password
3. Save
4. Edit user → Scroll to **Profile** section
5. Assign Role and Station
6. Mark as active

### Via Python Shell

```python
from django.contrib.auth.models import User
from Auth.models import Role, Station, UserProfile

# Create user
user = User.objects.create_user(
    username='health_officer',
    password='secure_password123',
    email='health@example.com'
)

# Get role and station
role = Role.objects.get(code='HEALTH_OFFICER')
station = Station.objects.get(code='CHIKURUBI')

# Create profile
profile = UserProfile.objects.create(
    user=user,
    role=role,
    station=station,
    is_active=True
)
```

## Role Permissions Matrix

| Role | Reception | Health | Stores | Farms | Admin | All Stations |
|------|-----------|--------|--------|-------|-------|--------------|
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN_OFFICER | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Own station) |
| RECEPTION_OFFICER | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (Own station) |
| HEALTH_OFFICER | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ (Own station) |
| STORES_OFFICER | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ (Own station) |
| FARMS_OFFICER | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ (Own station) |

## Next Steps

1. **Implement API endpoints** for each app (Reception, Health, Stores, etc.)
2. **Apply permissions** to views using permission classes
3. **Add station filtering** to all querysets
4. **Implement audit logging** for sensitive actions
5. **Connect frontend** to authentication endpoints

## Example: Implementing a Protected View

```python
# Reception/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from Auth.permissions import IsReceptionOfficer
from Auth.utils import log_action
from Reception.models import Inmate

class InmateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsReceptionOfficer]
    serializer_class = InmateSerializer
    
    def get_queryset(self):
        # Station-level data isolation
        station = self.request.user.userprofile.station
        return Inmate.objects.filter(station=station)
    
    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            request=self.request,
            action=f"Created inmate: {instance.prison_id}",
            module="INMATES",
            object_id=str(instance.prison_id),
            object_type="Inmate"
        )
```

## Common Issues

### Issue: "User profile not found" on login
**Solution**: User must have a UserProfile. Create it in Django Admin.

### Issue: "User account is inactive"
**Solution**: Check both `User.is_active` and `UserProfile.is_active` are True.

### Issue: Permission denied
**Solution**: 
1. Verify user has correct role
2. Check `permission_classes` in view
3. Ensure user profile is active

### Issue: CORS errors
**Solution**: Add frontend URL to `CORS_ALLOWED_ORIGINS` in `Core/settings.py`

## Production Deployment

See `Auth/README.md` for production checklist and security settings.

