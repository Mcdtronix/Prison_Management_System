from rest_framework import viewsets, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.apps import apps
from django.db.models import ForeignKey, OneToOneField, Q
from Auth.permissions import IsReceptionOfficer, IsAdminOrReception
from Auth.utils import log_action
from django.http import HttpResponse

import csv
import openpyxl
from io import BytesIO
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from .models import ReportTemplate
from .serializers import ReportTemplateSerializer
from .registry import get_field_registry
from .compiler import QueryCompiler


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD for Report Templates.
    Accessible to Reception Officers. All Reception officers can see all templates (as per user request).
    """
    queryset = ReportTemplate.objects.all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        try:
            from Auth.utils import get_current_role_code
            current_role = get_current_role_code(user)
            
            valid_ids = []
            for t in queryset:
                creator_role = get_current_role_code(t.created_by)
                
                if current_role == creator_role:
                    valid_ids.append(t.id)
                elif current_role in ['SUPER_ADMIN', 'ADMIN_OFFICER']:
                    # Admins can see templates created by other admins, and maybe everyone's?
                    # Let's keep it simple: they see admin templates. 
                    # If they need to see everyone's, we can just append.
                    if creator_role in ['SUPER_ADMIN', 'ADMIN_OFFICER']:
                        valid_ids.append(t.id)
                        
            return queryset.filter(id__in=valid_ids)
        except Exception:
            return queryset.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AvailableFieldsAPIView(views.APIView):
    """
    Returns the metadata-driven field registry for the report builder.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        base_model_name = request.query_params.get('base_model', 'Inmate')
        registry = get_field_registry(base_model_name)
        return Response({"fields": registry})


class GenerateReportAPIView(views.APIView):
    """
    Generates a report based on a saved template and dynamically applies query objects.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        template_id = request.data.get('template_id')
        export_format = request.data.get('export_format')
        limit = request.data.get('limit')
        
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
            if template.base_model == 'Officer':
                ModelClass = apps.get_model('HumanResources', 'Officer')
            elif template.base_model in ['Patient', 'OutPatientVisit', 'ChronicPatient', 'Medicine']:
                ModelClass = apps.get_model('Health', template.base_model)
            else:
                ModelClass = apps.get_model('Reception', 'Inmate')
        except LookupError:
            return Response({"error": "Base model not found"}, status=400)
            
        try:
            queryset = ModelClass.objects.all()
            
            if hasattr(request, 'org_context') and request.org_context:
                # Assuming Officer and Inmate both have some org relation, if applicable
                if hasattr(ModelClass, 'owner_org_unit'):
                    queryset = queryset.filter(owner_org_unit=request.org_context)
            
            # Apply filters via Compiler
            compiler = QueryCompiler(template.base_model, template.filters)
            q_objects = compiler.compile()
            if compiler.errors:
                return Response({"error": "Query Compilation Error", "details": compiler.errors}, status=400)
                
            excluded_ids = request.data.get('excluded_ids', [])

            queryset = queryset.filter(q_objects).distinct()
            
            if excluded_ids:
                queryset = queryset.exclude(id__in=excluded_ids)
                
            total_records = queryset.count()
            
            if limit:
                try:
                    limit = int(limit)
                    queryset = queryset[:limit]
                except ValueError:
                    pass
            
            # Map selected keys to ORM fields
            registry = get_field_registry(template.base_model)
            key_to_orm = {item['key']: item['field'] for item in registry}
            
            # Group fields by base or relationship for querying
            base_fields = []
            related_fields = {}
            for key in selected_fields:
                orm_field = key_to_orm.get(key, key)
                if '__' in orm_field:
                    rel, fld = orm_field.split('__', 1)
                    if rel not in related_fields:
                        related_fields[rel] = []
                    related_fields[rel].append({'key': key, 'orm_fld': fld})
                else:
                    base_fields.append({'key': key, 'orm_fld': orm_field})
                    
            if related_fields:
                queryset = queryset.prefetch_related(*related_fields.keys())
                
            data = []
            for inmate in queryset.iterator(chunk_size=100):
                row = {'_id': inmate.id}
                
                for bf in base_fields:
                    val = getattr(inmate, bf['orm_fld'], None)
                    row[bf['key']] = val
                        
                for rel, mapping_list in related_fields.items():
                    related_mgr = getattr(inmate, rel, None)
                    if related_mgr is None:
                        for m in mapping_list:
                            row[m['key']] = ""
                        continue
                        
                    if hasattr(related_mgr, 'all'):
                        related_objs = list(related_mgr.all())
                        if rel.endswith('_history'):
                            if related_objs:
                                # Get the latest by id
                                latest_obj = sorted(related_objs, key=lambda x: getattr(x, 'id', 0))[-1]
                                for m in mapping_list:
                                    row[m['key']] = getattr(latest_obj, m['orm_fld'], None)
                            else:
                                for m in mapping_list:
                                    row[m['key']] = ""
                        else:
                            for m in mapping_list:
                                values = []
                                for obj in related_objs:
                                    val = getattr(obj, m['orm_fld'], None)
                                    if val is not None and str(val).strip():
                                        values.append(str(val))
                                row[m['key']] = ", ".join(values) if values else ""
                    else:
                        for m in mapping_list:
                            row[m['key']] = getattr(related_mgr, m['orm_fld'], None)
                                
                data.append(row)
                    
                if len(data) >= 5000:
                    break
            
            if export_format == 'csv':
                log_action(request, f"Exported {template.name} as CSV", "REPORTS", template.id, "ReportTemplate", f"Records: {total_records}")
                return self._generate_csv(data, selected_fields, template.name)
            elif export_format == 'excel':
                log_action(request, f"Exported {template.name} as Excel", "REPORTS", template.id, "ReportTemplate", f"Records: {total_records}")
                return self._generate_excel(data, selected_fields, template.name)
            elif export_format == 'pdf':
                log_action(request, f"Exported {template.name} as PDF", "REPORTS", template.id, "ReportTemplate", f"Records: {total_records}")
                return self._generate_pdf(data, selected_fields, template.name)

            log_action(request, f"Generated {template.name} report view", "REPORTS", template.id, "ReportTemplate", f"Records: {total_records}")
            return Response({
                "data": data,
                "summary": f"{total_records} matching records"
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def _generate_csv(self, data, selected_fields, report_name):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{report_name}.csv"'
        writer = csv.DictWriter(response, fieldnames=selected_fields)
        writer.writeheader()
        writer.writerows(data)
        return response

    def _generate_excel(self, data, selected_fields, report_name):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Report"
        
        ws.append(selected_fields)
        for row in data:
            ws.append([row.get(f) for f in selected_fields])
            
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{report_name}.xlsx"'
        wb.save(response)
        return response

    def _generate_pdf(self, data, selected_fields, report_name):
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        
        styles = getSampleStyleSheet()
        elements.append(Paragraph(report_name, styles['Title']))
        elements.append(Spacer(1, 12))
        
        table_data = [selected_fields]
        for row in data:
            table_data.append([str(row.get(f, ''))[:50] for f in selected_fields])
            
        t = Table(table_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
        ]))
        
        elements.append(t)
        doc.build(elements)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{report_name}.pdf"'
        return response
