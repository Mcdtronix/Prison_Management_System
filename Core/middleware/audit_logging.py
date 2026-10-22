"""
Audit Logging Middleware
=======================
Logs mutations (POST, PUT, PATCH, DELETE) with organizational context.

This middleware captures all write operations and logs them with:
- User identity
- Organization unit
- Department
- Request method and path
- Response status
- Timestamp
- Relevant resource IDs (from request data)

Logs are written to Auth.AuditLog and also to standard logger.

Security considerations:
- Logs request body for POST/PUT/PATCH (be careful with sensitive fields)
- Captures IP address for audit trail
- Records success/failure of operations
- Enables compliance audit trails
"""

import logging
import json
from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone
from Auth.models import AuditLog

logger = logging.getLogger(__name__)


class AuditLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log all mutations with organizational context.
    
    Integrates with Auth.AuditLog model to maintain compliance-grade
    audit trail of all system modifications.
    """
    
    # HTTP methods that are considered mutations
    MUTATION_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
    
    # Paths to exclude from logging (e.g., health checks, status endpoints)
    EXCLUDE_PATHS = {
        '/api/health/',
        '/api/status/',
        '/api/ping/',
    }
    
    def process_request(self, request):
        """
        Capture request details for later audit logging.
        
        Store request body and details on request object for process_response.
        """
        
        # Store for later use in process_response
        request._audit_method = request.method
        request._audit_path = request.path
        request._audit_timestamp_start = timezone.now()
        request._audit_body = self._get_request_body(request)
        
        return None
    
    def process_response(self, request, response):
        """
        Log mutation if applicable.
        
        Called after response is generated; logs to AuditLog model.
        """
        
        # Skip if not a mutation
        if not hasattr(request, '_audit_method'):
            return response
        
        if request._audit_method not in self.MUTATION_METHODS:
            return response
        
        # Skip excluded paths
        if request._audit_path in self.EXCLUDE_PATHS:
            return response
        
        try:
            # Extract audit details
            user = request.user if request.user.is_authenticated else None
            org_unit = getattr(request, 'org_unit', None)
            department = getattr(request, 'department', None)
            status_code = response.status_code
            
            # Log to AuditLog model for all authenticated actors (including HQ and Provincial users)
            if user:
                from Auth.utils import get_user_operational_context, get_current_role_code

                org_unit, station = get_user_operational_context(request)
                role_name = get_current_role_code(user) or 'UNKNOWN'

                remarks_parts = [f"Status: {status_code}"]
                if org_unit:
                    remarks_parts.append(f"OrgUnit: {org_unit.code} ({org_unit.name})")
                if department:
                    remarks_parts.append(f"Dept: {getattr(department, 'code', str(department))}")

                AuditLog.objects.create(
                    user=user,
                    role=role_name,
                    station=station,
                    action=self._action_from_method_path(
                        request._audit_method, 
                        request._audit_path
                    ),
                    module=self._module_from_path(request._audit_path),
                    object_id=None,
                    object_type=None,
                    ip_address=self._get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                    request_method=request._audit_method,
                    request_path=request._audit_path,
                    remarks=" | ".join(remarks_parts),
                )
                
                logger.info(
                    f'Audit: {user.username} {request._audit_method} {request._audit_path} '
                    f'({status_code}) from {self._get_client_ip(request)}'
                )
        
        except Exception as e:
            logger.error(f'Error logging audit trail: {str(e)}')
            # Don't crash; continue serving response
        
        return response
    
    def _module_from_path(self, path):
        """Map request path to AuditLog module choice."""
        if '/api/reception/' in path:
            return 'INMATES'
        elif '/api/health/' in path:
            return 'HEALTH'
        elif '/api/stores/' in path:
            return 'STORES'
        elif '/api/farms/' in path:
            return 'FARMS'
        elif '/api/hr/' in path:
            return 'HR'
        elif '/api/auth/' in path:
            return 'AUTH'
        return 'API'

    def _get_request_body(self, request):
        """
        Extract request body for logging while masking passwords and sensitive tokens.
        """
        sensitive_keys = {'password', 'token', 'refresh', 'access', 'secret', 'otp'}
        try:
            if request.method in self.MUTATION_METHODS:
                body = request.body.decode('utf-8')
                if body:
                    try:
                        data = json.loads(body)
                        if isinstance(data, dict):
                            for key in list(data.keys()):
                                if any(s in key.lower() for s in sensitive_keys):
                                    data[key] = "******"
                            return json.dumps(data)[:500]
                        return body[:500]
                    except json.JSONDecodeError:
                        return body[:500]
        
        except Exception as e:
            logger.warning(f'Error extracting request body: {str(e)}')
        
        return None
    
    def _action_from_method_path(self, method, path):
        """
        Generate human-readable action string from HTTP method and path.
        """
        
        resource = path.split('/')[-2] if '/' in path else path
        
        action_map = {
            'POST': f'CREATE_{resource.upper()}',
            'PUT': f'UPDATE_{resource.upper()}',
            'PATCH': f'MODIFY_{resource.upper()}',
            'DELETE': f'DELETE_{resource.upper()}',
        }
        
        return action_map.get(method, f'UNKNOWN_{method}')
    
    def _get_client_ip(self, request):
        """
        Extract client IP from request.
        
        Handles proxied requests (X-Forwarded-For header).
        """
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        
        return ip
