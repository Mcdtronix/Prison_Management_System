"""
Core Mixins for ViewSets
"""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied


# Station rules for `StationScopedMixin.scope_rule`. Each returns a function
# (queryset, scope) -> queryset built on the rules in Auth/scoping.py.

def by_inmate(prefix=''):
    """Records owned through an inmate, e.g. by_inmate('offence__inmate__')."""
    def rule(queryset, scope):
        from Auth.scoping import inmates_in_scope
        return inmates_in_scope(queryset, scope, prefix)
    return rule


def by_officer(officer_path='officer'):
    """Records about an officer, e.g. by_officer('charge_sheet__officer')."""
    def rule(queryset, scope):
        from Auth.scoping import officer_records_in_scope
        return officer_records_in_scope(queryset, scope, officer_path)
    return rule


def by_units(*unit_paths):
    """Records pointing at an org unit, e.g. by_units('project__owner_org_unit')."""
    def rule(queryset, scope):
        from Auth.scoping import units_in_scope
        return units_in_scope(queryset, scope, *unit_paths)
    return rule


class StationScopedMixin:
    """Keeps a viewset to records at the user's station or below.

    Set `scope_rule` to one of the rules above. Lists, detail views, updates
    and deletes only ever see records in scope (404 otherwise). Creates and
    updates are checked after saving and rolled back if the record would land
    outside the user's scope, such as an offence attached to another
    station's inmate. Scope comes from `Auth.scoping.people_scope`, the same
    one the Report Builder and Discharge Diary use.
    """
    scope_rule = None
    # The station rule replaces the global Core.filters.OrgUnitAccessFilterBackend,
    # which only knows a user's primary assignment and lets owner-less rows through.
    filter_backends = []

    def get_scope(self):
        request = self.request
        if not hasattr(request, '_people_scope'):
            from Auth.scoping import people_scope
            request._people_scope = people_scope(request.user)
        return request._people_scope

    def _rule(self):
        return type(self).scope_rule  # read from the class so it stays a plain function

    def get_queryset(self):
        queryset = super().get_queryset()
        rule = self._rule()
        return queryset if rule is None else rule(queryset, self.get_scope())

    def record_in_scope(self, obj):
        rule = self._rule()
        if rule is None:
            return True
        return rule(type(obj)._default_manager.filter(pk=obj.pk), self.get_scope()).exists()

    def _require_in_scope(self, obj):
        if not self.record_in_scope(obj):
            raise PermissionDenied({
                "error_code": "STATION_MISMATCH",
                "message": "You do not have permission to modify this record.",
                "details": "The record would belong to another organization unit.",
                "resolution": "If you require access, please contact the administrators.",
            })

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            self._require_in_scope(serializer.instance)

    def perform_update(self, serializer):
        with transaction.atomic():
            super().perform_update(serializer)
            self._require_in_scope(serializer.instance)


class OrgUnitContextMixin:
    """
    Automatically injects organizational context during object creation.
    Requires OrgContextMiddleware to be active and properly setting request.org_unit.
    """
    
    def perform_create(self, serializer):
        kwargs = {}
        
        request = getattr(self, 'request', None)
        if request:
            org_unit = getattr(request, 'org_unit', None)
            
            if org_unit:
                # Check what fields the model has
                model = serializer.Meta.model
                model_fields = {f.name for f in model._meta.get_fields()}
                
                if 'owner_org_unit' in model_fields and not serializer.validated_data.get('owner_org_unit'):
                    kwargs['owner_org_unit'] = org_unit
                if 'org_unit' in model_fields and not serializer.validated_data.get('org_unit'):
                    kwargs['org_unit'] = org_unit
                if 'receiving_org_unit' in model_fields and not serializer.validated_data.get('receiving_org_unit'):
                    kwargs['receiving_org_unit'] = org_unit
                if 'providing_org_unit' in model_fields and not serializer.validated_data.get('providing_org_unit'):
                    kwargs['providing_org_unit'] = org_unit
                if 'consuming_org_unit' in model_fields and not serializer.validated_data.get('consuming_org_unit'):
                    kwargs['consuming_org_unit'] = org_unit
                if 'posting_org_unit' in model_fields and not serializer.validated_data.get('posting_org_unit'):
                    kwargs['posting_org_unit'] = org_unit
                    
                # Also assign station if applicable
                if 'station' in model_fields and not serializer.validated_data.get('station'):
                    if org_unit.unit_type == 'STATION':
                        from Auth.utils import legacy_station_for_unit
                        station = legacy_station_for_unit(org_unit)
                        if station:
                            kwargs['station'] = station

        # Save with injected kwargs
        serializer.save(**kwargs)
