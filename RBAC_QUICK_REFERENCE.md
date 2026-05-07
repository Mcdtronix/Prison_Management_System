# RBAC Quick Reference

Quick reference guide for developers implementing RBAC in views and APIs.

## Permission Classes

```python
from Auth.permissions import (
    IsSuperAdmin,
    IsAdminOfficer,
    IsReceptionOfficer,
    IsHealthOfficer,
    IsStoresOfficer,
    IsFarmsOfficer,
)
```

## Using in Views

```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from Auth.permissions import IsHealthOfficer

class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsHealthOfficer]
    # Your view code
```

## Station-Level Filtering

**MANDATORY**: Always filter by station in `get_queryset()`

```python
def get_queryset(self):
    station = self.request.user.userprofile.station
    return MyModel.objects.filter(station=station)
```

## Audit Logging

```python
from Auth.utils import log_action

def perform_create(self, serializer):
    instance = serializer.save()
    log_action(
        request=self.request,
        action=f"Created {instance.__class__.__name__}: {instance.id}",
        module="MODULE_NAME",  # INMATES, HEALTH, STORES, etc.
        object_id=str(instance.id),
        object_type=instance.__class__.__name__,
        remarks="Optional remarks"
    )
```

## Getting Current User Info

```python
# In a view
user = request.user
role = request.user.userprofile.role.code
station = request.user.userprofile.station
```

## JWT Token Structure

After login, JWT contains:
- `role` - User's role code
- `station_id` - Station ID
- `station_code` - Station code
- `user_id` - User ID
- `username` - Username

## API Endpoints

- `POST /api/auth/login/` - Login
- `POST /api/auth/token/refresh/` - Refresh token
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/me/` - Current user profile
- `GET /api/auth/users/` - List users (Admin only)

## Common Patterns

### Pattern 1: Create with Audit Log

```python
def perform_create(self, serializer):
    instance = serializer.save()
    log_action(
        request=self.request,
        action=f"Created {instance.__class__.__name__}",
        module="MODULE_NAME",
        object_id=str(instance.id)
    )
```

### Pattern 2: Update with Audit Log

```python
def perform_update(self, serializer):
    instance = serializer.save()
    log_action(
        request=self.request,
        action=f"Updated {instance.__class__.__name__}",
        module="MODULE_NAME",
        object_id=str(instance.id)
    )
```

### Pattern 3: Delete with Audit Log

```python
def perform_destroy(self, instance):
    object_id = str(instance.id)
    instance.delete()
    log_action(
        request=self.request,
        action=f"Deleted {instance.__class__.__name__}",
        module="MODULE_NAME",
        object_id=object_id
    )
```

### Pattern 4: Custom Action with Audit Log

```python
@action(detail=True, methods=['post'])
def approve(self, request, pk=None):
    instance = self.get_object()
    instance.status = 'APPROVED'
    instance.save()
    
    log_action(
        request=request,
        action=f"Approved {instance.__class__.__name__}",
        module="MODULE_NAME",
        object_id=str(instance.id)
    )
    
    return Response({'status': 'approved'})
```

## Module Codes for Audit Logs

- `AUTH` - Authentication actions
- `INMATES` - Inmate management
- `HEALTH` - Health records
- `STORES` - Inventory/stores
- `FARMS` - Agricultural production
- `HR` - Human resources
- `RBAC` - Role management

## Security Checklist

- [ ] Permission classes applied to view
- [ ] Station filtering in `get_queryset()`
- [ ] Audit logging for create/update/delete
- [ ] Input validation
- [ ] No sensitive data in error messages
- [ ] Proper HTTP status codes

