"""
Core Mixins for ViewSets
"""

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
                        from Auth.models import Station
                        station = Station.objects.filter(org_unit=org_unit).first()
                        if station:
                            kwargs['station'] = station

        # Save with injected kwargs
        serializer.save(**kwargs)
