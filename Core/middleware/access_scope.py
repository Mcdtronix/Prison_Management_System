"""
Access Scope Middleware
=======================
Computes data exposure scope based on organizational hierarchy and policies.

This middleware determines what data a user can see based on:
1. Their organizational unit position (Station → Province → National)
2. Their role and department
3. Any explicit DataExposurePolicy entries
4. Upward visibility policies (can see child orgs' data)

Pattern:
    request.access_scope: Dict containing visibility rules for this request
    request.visible_org_units: QuerySet of org units user can see data from
    request.data_exposure_policies: Dict of policies applicable to user

The access scope is used by ViewSet filters to restrict querysets.
"""

import logging
from django.utils.deprecation import MiddlewareMixin
from django.db.models import Q
from Auth.models import OrgUnit, DataExposurePolicy

logger = logging.getLogger(__name__)


class AccessScopeMiddleware(MiddlewareMixin):
    """
    Middleware to compute organizational data access scope.
    
    Builds a data exposure scope for the authenticated user based on:
    - Their org_unit position in hierarchy
    - Active DataExposurePolicy entries
    - Role-based visibility rules
    """
    
    def process_request(self, request):
        """
        Compute access scope and attach to request.
        """
        
        # Initialize default scope (no visibility)
        request.access_scope = None
        request.visible_org_units = OrgUnit.objects.none()
        request.data_exposure_policies = {}
        
        # Skip if no org context set (by OrgContextMiddleware)
        if not hasattr(request, 'org_unit') or not request.org_unit:
            return None
        
        try:
            # Build list of visible org units
            visible_org_units = self._compute_visible_org_units(request.org_unit)
            request.visible_org_units = visible_org_units
            
            # Build data exposure policies
            policies = self._compute_exposure_policies(
                request.org_unit, 
                request.user_assignment
            )
            request.data_exposure_policies = policies
            
            # Build summary access scope
            request.access_scope = {
                'org_unit': request.org_unit.code,
                'visible_org_units': [u.code for u in visible_org_units],
                'is_national': request.org_unit.unit_type == 'NATIONAL_HQ',
                'is_provincial': request.org_unit.unit_type == 'PROVINCIAL_HQ',
                'is_station': request.org_unit.unit_type == 'STATION',
                'policies_active': len(policies) > 0,
            }
            
            logger.debug(
                f'Access scope computed for {request.user.username}: '
                f'{len(visible_org_units)} visible org units'
            )
        
        except Exception as e:
            logger.error(
                f'Error computing access scope for {request.user.username}: {str(e)}'
            )
            # Don't crash; continue with restrictive default (none visible)
        
        return None
    
    def _compute_visible_org_units(self, user_org_unit):
        """
        Determine which organization units user can see data from.
        
        Visibility rules:
        - Station users: See only their station
        - Provincial users: See their province + all child stations
        - National users: See all org units (but respects policies)
        """
        
        if user_org_unit.unit_type == 'STATION':
            # Station users see only their station
            return OrgUnit.objects.filter(id=user_org_unit.id)
        
        elif user_org_unit.unit_type == 'PROVINCIAL_HQ':
            # Provincial users see province + all child stations
            return OrgUnit.objects.filter(
                Q(id=user_org_unit.id) |  # The province itself
                Q(parent=user_org_unit, active=True)  # Child stations
            )
        
        elif user_org_unit.unit_type == 'NATIONAL_HQ':
            # National users see all org units (but policies may restrict)
            return OrgUnit.objects.filter(active=True)
        
        # Default: empty (restrictive)
        return OrgUnit.objects.none()
    
    def _compute_exposure_policies(self, user_org_unit, user_assignment):
        """
        Find applicable DataExposurePolicy entries.
        
        Policies are keyed by (source_org_code, module) for quick lookup
        in ViewSet filters.
        
        Example:
            {
                ('CHIVHU_STN', 'RECEPTION'): {
                    'visibility_level': 'SUMMARY',
                    'custom_fields': [...],
                    'requires_approval': False,
                },
                ...
            }
        """
        policies = {}
        
        try:
            # Get all active policies where this org_unit receives data
            exposure_policies = DataExposurePolicy.objects.filter(
                target_org_unit=user_org_unit,
                status='APPROVED'
            ).select_related('source_org_unit')
            
            for policy in exposure_policies:
                key = (policy.source_org_unit.code, policy.module)
                policies[key] = {
                    'visibility_level': policy.visibility_level,
                    'custom_fields': policy.custom_fields,
                    'policy_id': policy.id,
                }
        
        except Exception as e:
            logger.error(f'Error loading exposure policies: {str(e)}')
        
        return policies
