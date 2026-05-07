# RBAC (Role-Based Access Control) System

Production-grade authentication and authorization system for the Prison Management System.

## Features

- ✅ JWT-based authentication (stateless, scalable)
- ✅ Role-based access control (RBAC)
- ✅ Station-level data isolation
- ✅ Comprehensive audit logging
- ✅ Django Admin integration
- ✅ DRF permission classes
- ✅ Custom JWT payload with role/station info

## Architecture

### Models

1. **Role** - Defines user roles (SUPER_ADMIN, ADMIN_OFFICER, RECEPTION_OFFICER, etc.)
2. **Station** - Prison stations/locations (security boundary for data isolation)
3. **UserProfile** - Extends Django User with role and station assignment
4. **AuditLog** - Comprehensive audit trail for all sensitive actions

### Authentication Flow

1. User logs in via `POST /api/auth/login/`
2. Backend validates credentials and returns JWT token
3. JWT payload includes: `role`, `station_id`, `station_code`, `user_id`
4. Frontend stores token and redirects based on role
5. All subsequent requests include JWT in Authorization header

### Authorization Flow

1. Frontend checks role for route protection (UI-level)
2. Backend enforces permissions via DRF permission classes (mandatory)
3. All queries filtered by station (data isolation)
4. All actions logged to audit trail

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run Migrations

```bash
python manage.py makemigrations Auth
python manage.py migrate
```

### 3. Initialize RBAC System

```bash
python manage.py init_rbac
```

This creates:
- Default roles (SUPER_ADMIN, ADMIN_OFFICER, RECEPTION_OFFICER, etc.)
- Example stations (CHIKURUBI, HARARE, BULAWAYO, etc.)

### 4. Create Superuser

```bash
python manage.py createsuperuser
```

### 5. Assign Role and Station

1. Go to Django Admin: `http://localhost:8000/admin/`
2. Navigate to Users → Select your user
3. Create/edit User Profile:
   - Select Role (e.g., SUPER_ADMIN)
   - Select Station (e.g., CHIKURUBI)
   - Mark as Active

## API Endpoints

### Authentication

- `POST /api/auth/login/` - Login (returns JWT token)
- `POST /api/auth/token/refresh/` - Refresh JWT token
- `POST /api/auth/logout/` - Logout (client-side token removal)
- `GET /api/auth/me/` - Get current user profile
- `GET /api/auth/users/` - List users (Admin only)

### Example Login Request

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "yourpassword"
  }'
```

### Example Login Response

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "role": "SUPER_ADMIN",
  "role_name": "Super Administrator",
  "station_id": 1,
  "station_code": "CHIKURUBI",
  "station_name": "Chikurubi Maximum Security Prison",
  "user_id": 1,
  "username": "admin"
}
```

### Example Authenticated Request

```bash
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."
```

## Using Permissions in Views

### Example: Health Officer Only View

```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from Auth.permissions import IsHealthOfficer
from Health.models import OutPatientVisit

class OutPatientVisitViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHealthOfficer]
    queryset = OutPatientVisit.objects.all()
    
    def get_queryset(self):
        # Station-level data isolation
        station = self.request.user.userprofile.station
        return OutPatientVisit.objects.filter(
            patient__inmate__station=station  # Adjust based on your model structure
        )
```

### Available Permission Classes

- `IsSuperAdmin` - Only super admin
- `IsAdminOfficer` - Admin officers and super admins
- `IsReceptionOfficer` - Reception officers and admins
- `IsHealthOfficer` - Health officers and admins
- `IsStoresOfficer` - Stores officers and admins
- `IsFarmsOfficer` - Farms officers and admins

## Audit Logging

### Logging Actions

```python
from Auth.utils import log_action

def create_inmate(request, inmate_data):
    inmate = Inmate.objects.create(**inmate_data)
    
    # Log the action
    log_action(
        request=request,
        action=f"Created inmate record: {inmate.prison_id}",
        module="INMATES",
        object_id=str(inmate.prison_id),
        object_type="Inmate",
        remarks="New inmate registration"
    )
    
    return inmate
```

### Viewing Audit Logs

- Django Admin: `http://localhost:8000/admin/Auth/auditlog/`
- Filter by: user, role, station, module, date range

## Station-Level Data Isolation

**CRITICAL**: All queries must filter by station.

```python
def get_queryset(self):
    station = self.request.user.userprofile.station
    return Inmate.objects.filter(station=station)
```

This ensures:
- Station A never sees Station B data
- Same role, different station = isolated data
- Multi-tenant security boundary

## Security Best Practices

1. ✅ **Backend is final authority** - Frontend restrictions are NOT sufficient
2. ✅ **Always filter by station** - Every query must include station filter
3. ✅ **Log all sensitive actions** - Use `log_action()` utility
4. ✅ **Use JWT tokens** - Stateless, no session leakage
5. ✅ **Validate permissions** - Use DRF permission classes
6. ✅ **Never trust frontend** - Always verify permissions server-side

## Frontend Integration

### Login Flow

```typescript
// Login
const response = await fetch('/api/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

const data = await response.json();
// data contains: access, refresh, role, station_id, station_code

// Store token
localStorage.setItem('token', data.access);

// Redirect based on role
switch(data.role) {
  case 'HEALTH_OFFICER':
    navigate('/health');
    break;
  case 'RECEPTION_OFFICER':
    navigate('/reception');
    break;
  // ...
}
```

### Authenticated Requests

```typescript
const token = localStorage.getItem('token');
const response = await fetch('/api/auth/me/', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Troubleshooting

### "User profile not found"
- User must have a UserProfile assigned
- Go to Django Admin → Users → Select user → Create/edit profile

### "User account is inactive"
- Check UserProfile.is_active = True
- Check User.is_active = True

### Permission denied
- Verify user has correct role assigned
- Check permission_classes in view
- Verify station assignment

### CORS errors
- Add frontend URL to `CORS_ALLOWED_ORIGINS` in settings.py
- Ensure CORS middleware is enabled

## Production Checklist

- [ ] Change `SECRET_KEY` in settings.py
- [ ] Set `DEBUG = False`
- [ ] Configure PostgreSQL database
- [ ] Set `SESSION_COOKIE_SECURE = True`
- [ ] Set `CSRF_COOKIE_SECURE = True`
- [ ] Enable HTTPS (`SECURE_SSL_REDIRECT = True`)
- [ ] Configure Redis for caching (optional)
- [ ] Set up proper logging
- [ ] Configure backup strategy
- [ ] Review audit logs regularly

## Support

For issues or questions, refer to:
- Django REST Framework: https://www.django-rest-framework.org/
- Simple JWT: https://django-rest-framework-simplejwt.readthedocs.io/
- Django Authentication: https://docs.djangoproject.com/en/stable/topics/auth/

