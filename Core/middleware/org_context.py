"""
Organizational Context Middleware
==================================
Extracts user's organizational assignment and attaches org_unit context to request.

This middleware ensures every authenticated request has a proper organizational
context (org_unit, department, role) for downstream use.

Pattern:
    request.org_unit: Primary organizational unit for this user
    request.department: Primary department assignment
    request.role: Primary role
    request.user_assignment: Full UserAssignment object

Security:
    - Unauthenticated requests pass through unchanged (org_unit=None)
    - Authentication happens before middleware (MIDDLEWARE order matters!)
    - Users without assignment will have None context (catches permission failures downstream)
"""

import logging
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth.models import AnonymousUser
from Auth.models import UserAssignment

logger = logging.getLogger(__name__)


class OrgContextMiddleware(MiddlewareMixin):
    """
    Middleware to attach organizational context to every request.
    
    Resolves the requesting user's primary organizational assignment and
    attaches org_unit, department, and role info to the request object.
    """
    
    def process_request(self, request):
        """
        Attach organizational context to request.
        
        Called at the beginning of each request processing.
        Executed in order defined in MIDDLEWARE setting.
        """
        
        # Initialize default context (no organization)
        request.org_unit = None
        request.department = None
        request.role = None
        request.user_assignment = None
        request.has_org_context = False
        
        # Try to resolve JWT user if not already authenticated by session middleware
        if not hasattr(request, 'user') or request.user.is_anonymous:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                try:
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    jwt_auth = JWTAuthentication()
                    raw_token = auth_header.split(' ')[1]
                    validated_token = jwt_auth.get_validated_token(raw_token)
                    user = jwt_auth.get_user(validated_token)
                    request.user = user
                except Exception as e:
                    logger.debug(f"JWT Authentication in middleware failed: {str(e)}")
        
        # Skip if user is still not authenticated
        if not hasattr(request, 'user') or request.user.is_anonymous:
            return None
        
        try:
            # Attempt to get user's primary assignment
            user_assignment = UserAssignment.objects.select_related(
                'org_unit', 'department', 'role'
            ).filter(
                user=request.user,
                is_active=True,
                is_primary=True
            ).first()
            
            if user_assignment:
                # Attach organizational context
                request.org_unit = user_assignment.org_unit
                request.department = user_assignment.department
                request.role = user_assignment.role
                request.user_assignment = user_assignment
                request.has_org_context = True
                
                logger.debug(
                    f'User {request.user.username} attached to org '
                    f'{request.org_unit.code}/{request.department.code}'
                )
            else:
                # User has no active primary assignment
                logger.warning(
                    f'User {request.user.username} has no active primary assignment'
                )
        
        except Exception as e:
            logger.error(
                f'Error resolving org context for user {request.user.username}: {str(e)}'
            )
            # Don't crash; allow request to continue with None context
            # Access control middleware will reject if needed
        
        return None
    
    def process_response(self, request, response):
        """
        Cleanup after request processing (optional).
        
        Add response headers for debugging if needed.
        """
        if hasattr(request, 'org_unit') and request.org_unit:
            # Add header for debugging/tracing
            response['X-Org-Unit'] = request.org_unit.code
            response['X-Department'] = request.department.code if request.department else 'NONE'
        
        return response
