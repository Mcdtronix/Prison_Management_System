from django.db.models import Q
from rest_framework.filters import BaseFilterBackend


class OrgUnitAccessFilterBackend(BaseFilterBackend):
    """
    Automatically restrict querysets to org units visible to the requesting user.

    This backend only applies when the target model exposes one or more org unit
    ownership fields, such as owner_org_unit, org_unit, receiving_org_unit,
    providing_org_unit, consuming_org_unit, or posting_org_unit.
    """

    ORG_FIELDS = [
        'owner_org_unit',
        'org_unit',
        'receiving_org_unit',
        'providing_org_unit',
        'consuming_org_unit',
        'posting_org_unit',
        'source_org_unit',
        'target_org_unit',
    ]

    def filter_queryset(self, request, queryset, view):
        visible_org_units = getattr(request, 'visible_org_units', None)

        if visible_org_units is None:
            return queryset


        org_fields = self._get_applicable_org_fields(queryset.model)
        if not org_fields:
            return queryset

        query = Q()
        for field in org_fields:
            query |= Q(**{f"{field}__in": visible_org_units}) | Q(**{f"{field}__isnull": True})

        return queryset.filter(query).distinct()

    def _get_applicable_org_fields(self, model):
        model_field_names = {field.name for field in model._meta.get_fields()}
        return [field for field in self.ORG_FIELDS if field in model_field_names]

    def _has_org_fields(self, model):
        return bool(self._get_applicable_org_fields(model))
