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

    # Reference lookup models that represent global/shared catalogs across all stations
    GLOBAL_CATALOG_MODELS = {
        'itemcategory',
        'rank',
        'qualificationtype',
        'course',
        'offencetype',
        'croptype',
        'animaltype',
        'maritalstatus',
    }

    def filter_queryset(self, request, queryset, view):
        visible_org_units = getattr(request, 'visible_org_units', None)

        if visible_org_units is None:
            return queryset

        org_fields = self._get_applicable_org_fields(queryset.model)
        if not org_fields:
            return queryset

        # Check whether unassigned records (field is NULL) should be visible:
        # 1. Global catalog models where NULL represents system-wide shared catalog data
        is_catalog = (
            getattr(queryset.model, '_is_global_catalog', False) or
            queryset.model._meta.model_name in self.GLOBAL_CATALOG_MODELS
        )

        # 2. Authorized Headquarters / Superuser access for legacy triage
        is_national_hq = (
            getattr(request.user, 'is_superuser', False) or
            (hasattr(request, 'org_unit') and getattr(request.org_unit, 'unit_type', None) == 'NATIONAL_HQ') or
            (hasattr(request, 'access_scope') and isinstance(request.access_scope, dict) and request.access_scope.get('is_national'))
        )

        allow_null = is_catalog or is_national_hq

        query = Q()
        for field in org_fields:
            if allow_null:
                query |= Q(**{f"{field}__in": visible_org_units}) | Q(**{f"{field}__isnull": True})
            else:
                query |= Q(**{f"{field}__in": visible_org_units})

        return queryset.filter(query).distinct()

    def _get_applicable_org_fields(self, model):
        model_field_names = {field.name for field in model._meta.get_fields()}
        return [field for field in self.ORG_FIELDS if field in model_field_names]

    def _has_org_fields(self, model):
        return bool(self._get_applicable_org_fields(model))
