from rest_framework import viewsets, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.apps import apps
from django.db.models import ForeignKey, OneToOneField
from Auth.permissions import IsReceptionOfficer

from .models import ReportTemplate
from .serializers import ReportTemplateSerializer


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD for Report Templates.
    Accessible to Reception Officers. All Reception officers can see all templates (as per user request).
    """
    queryset = ReportTemplate.objects.all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated, IsReceptionOfficer] # Since this is currently scoped for Reception

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AvailableFieldsAPIView(views.APIView):
    """
    Returns available fields specifically for the Inmate model and its relations.
    """
    permission_classes = [IsAuthenticated, IsReceptionOfficer]

    def get(self, request, *args, **kwargs):
        Inmate = apps.get_model('Reception', 'Inmate')
        schema = {}
        
        # Base Inmate fields
        inmate_fields = []
        for field in Inmate._meta.get_fields():
            if field.is_relation and field.many_to_many:
                continue
                
            # Handle reverse relations (one-to-many) like offences, discharges
            if field.is_relation and field.one_to_many:
                related_model = field.related_model
                
                # Exclude specific external or restricted models from Reception reports
                if related_model.__name__ == 'Patient':
                    continue
                    
                related_fields = []
                for rf in related_model._meta.get_fields():
                    if rf.is_relation:
                        continue # Skip nested relations for simplicity
                    related_fields.append({
                        'name': f"{field.name}__{rf.name}",
                        'verbose_name': getattr(rf, 'verbose_name', rf.name).title(),
                        'type': type(rf).__name__,
                        'is_relation': False,
                    })
                
                if related_fields:
                    schema[related_model.__name__] = {
                        'verbose_name': related_model._meta.verbose_name.title(),
                        'fields': related_fields
                    }
                continue
                
            # Handle standard fields
            field_type = type(field).__name__
            inmate_fields.append({
                'name': field.name,
                'verbose_name': getattr(field, 'verbose_name', field.name).title(),
                'type': field_type,
                'is_relation': field.is_relation,
            })
            
        schema['Inmate'] = {
            'verbose_name': 'Inmate Details',
            'fields': inmate_fields
        }
            
        return Response(schema)


class GenerateReportAPIView(views.APIView):
    """
    Generates a report based on a given template ID, always rooted at Inmate.
    """
    permission_classes = [IsAuthenticated, IsReceptionOfficer]

    def post(self, request, *args, **kwargs):
        template_id = request.data.get('template_id')
        
        if not template_id:
            return Response({"error": "template_id is required"}, status=400)
            
        try:
            template = ReportTemplate.objects.get(id=template_id)
        except ReportTemplate.DoesNotExist:
            return Response({"error": "Template not found"}, status=404)
            
        selected_fields = template.selected_fields 
        
        if not selected_fields:
            return Response({"error": "No fields selected in template"}, status=400)
            
        try:
            Inmate = apps.get_model('Reception', 'Inmate')
        except LookupError:
            return Response({"error": "Inmate model not found"}, status=400)
            
        try:
            queryset = Inmate.objects.all()
            
            if hasattr(request, 'org_context') and request.org_context:
                queryset = queryset.filter(owner_org_unit=request.org_context)
            
            # Parse fields
            base_fields = []
            related_fields = {}
            for f in selected_fields:
                if '__' in f:
                    rel, fld = f.split('__', 1)
                    if rel not in related_fields:
                        related_fields[rel] = []
                    related_fields[rel].append(fld)
                else:
                    base_fields.append(f)
                    
            if related_fields:
                queryset = queryset.prefetch_related(*related_fields.keys())
                
            data = []
            for inmate in queryset.iterator(chunk_size=100):
                row = {}
                row_has_empty = False
                
                for bf in base_fields:
                    val = getattr(inmate, bf, None)
                    row[bf] = val
                    if val is None or str(val).strip() == '':
                        row_has_empty = True
                        
                for rel, flds in related_fields.items():
                    related_mgr = getattr(inmate, rel, None)
                    if related_mgr is None:
                        for fld in flds:
                            row[f"{rel}__{fld}"] = ""
                        row_has_empty = True
                        continue
                        
                    if hasattr(related_mgr, 'all'):
                        related_objs = list(related_mgr.all())
                        if rel == 'classification_history':
                            if related_objs:
                                # Get the latest by id
                                latest_obj = sorted(related_objs, key=lambda x: getattr(x, 'id', 0))[-1]
                                for fld in flds:
                                    val = getattr(latest_obj, fld, None)
                                    row[f"{rel}__{fld}"] = val
                                    if val is None or str(val).strip() == '':
                                        row_has_empty = True
                            else:
                                for fld in flds:
                                    row[f"{rel}__{fld}"] = ""
                                row_has_empty = True
                        else:
                            for fld in flds:
                                values = []
                                for obj in related_objs:
                                    val = getattr(obj, fld, None)
                                    if val is not None and str(val).strip():
                                        values.append(str(val))
                                row[f"{rel}__{fld}"] = ", ".join(values) if values else ""
                                if not values:
                                    row_has_empty = True
                    else:
                        for fld in flds:
                            val = getattr(related_mgr, fld, None)
                            row[f"{rel}__{fld}"] = val
                            if val is None or str(val).strip() == '':
                                row_has_empty = True
                                
                if not row_has_empty:
                    data.append(row)
                    
                if len(data) >= 1000:
                    break
            
            return Response({"data": data})
            
        except Exception as e:
            return Response({"error": str(e)}, status=400)
