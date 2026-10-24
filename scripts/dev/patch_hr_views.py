import re

with open('HumanResources/views.py', 'r') as f:
    content = f.read()

mixin = """
class OfficerFilterMixin:
    def get_queryset(self):
        queryset = super().get_queryset()
        officer_id = self.request.query_params.get('officer', None)
        if officer_id is not None:
            if hasattr(self.queryset.model, 'officer'):
                queryset = queryset.filter(officer_id=officer_id)
        return queryset

"""

if "class OfficerFilterMixin" not in content:
    content = content.replace("class OfficerViewSet", mixin + "class OfficerViewSet")

    targets = [
        "OfficerStationHistoryViewSet",
        "OfficerRankHistoryViewSet",
        "OfficerQualificationViewSet",
        "OfficerCourseHistoryViewSet",
        "ChargeSheetViewSet",
        "DependantViewSet",
        "OfficerDocumentViewSet",
        "OfficerAuditTrailViewSet"
    ]
    for target in targets:
        content = content.replace(f"class {target}(OrgUnitContextMixin, viewsets.ModelViewSet):", f"class {target}(OfficerFilterMixin, OrgUnitContextMixin, viewsets.ModelViewSet):")

    with open('HumanResources/views.py', 'w') as f:
        f.write(content)
        print("Patched successfully")
else:
    print("Already patched")
