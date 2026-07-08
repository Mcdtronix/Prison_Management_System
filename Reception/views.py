from rest_framework import viewsets, status
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.utils import timezone

from .models import (
    Inmate,
    NextOfKin,
    InmateStationHistory,
    InmateClassificationHistory,
    Offence,
    Convicted,
    Unconvicted,
    Restitution,
    CourtSession,
    RestitutionExtension,
    # ReleaseHistory,
    InmatePropertyHistory,
    EscapeHistory,
    InmateDisciplinaryHistory,
    # InmateMedicalHistory,
    InmateDocument,
    InmateAuditTrail,
    Discharged,
    ReleaseWorkflow,
)
from .serializers import (
    InmateSerializer,
    NextOfKinSerializer,
    InmateStationHistorySerializer,
    InmateClassificationHistorySerializer,
    OffenceSerializer,
    ConvictedSerializer,
    UnconvictedSerializer,
    RestitutionSerializer,
    CourtSessionSerializer,
    RestitutionExtensionSerializer,
    BasicInmateRegistrationSerializer,
    OffenceRegistrationSerializer,
    ComprehensiveInmateSerializer,
    CourtSessionCreateSerializer,
    # ReleaseHistorySerializer,
    InmatePropertyHistorySerializer,
    EscapeHistorySerializer,
    InmateDisciplinaryHistorySerializer,
    # InmateMedicalHistorySerializer,
    InmateDocumentSerializer,
    InmateAuditTrailSerializer,
    InmateListSerializer,
    UpcomingCourtSessionSerializer,
    ScheduleCourtSessionSerializer,
)


from Auth.permissions import IsReceptionOrHealthOrAdmin, IsAdminOfficer

class InmateViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Inmate.objects.all()
    serializer_class = InmateSerializer
    permission_classes = [IsAuthenticated, IsReceptionOrHealthOrAdmin]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ComprehensiveInmateSerializer
        return InmateSerializer

    def get_queryset(self):
        if self.action == 'retrieve':
            return Inmate.objects.prefetch_related(
                'next_of_kin',
                'classification_history',
                'station_history',
                'offences__conviction',
                'offences__unconviction',
                'property_history'
            )
        return Inmate.objects.all()

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def validate_unique(self, request):
        """Validate if prison_number or national_id already exists."""
        prison_number = request.data.get('prison_number')
        national_id = request.data.get('national_id')
        errors = {}
        
        if prison_number and Inmate.objects.filter(prison_number=prison_number).exists():
            errors['prison_number'] = ['Prison number already exists']
            
        if national_id and Inmate.objects.filter(national_id=national_id).exists():
            errors['national_id'] = ['National ID already exists']
            
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOfficer])
    def approve_admission(self, request, pk=None):
        inmate = self.get_object()
        if inmate.admission_status != "PENDING_ADMIN_APPROVAL":
            return Response(
                {"error": "Inmate is not pending admin approval. Ensure health assessment is complete."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify health assessment actually exists as a final check
        if not hasattr(inmate, 'admission_health_assessment'):
             return Response(
                {"error": "Cannot approve admission: Health assessment is missing."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        inmate.admission_status = "ADMISSION_CONFIRMED"
        inmate.save(update_fields=['admission_status'])
        return Response({"status": "Admission confirmed successfully."})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOfficer])
    def approve_reclassification(self, request, pk=None):
        inmate = self.get_object()
        pending_classifications = inmate.classification_history.filter(approval_status="PENDING")
        if not pending_classifications.exists():
            return Response({"error": "No pending reclassifications found for this inmate."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Approve the most recent pending classification
        classification = pending_classifications.latest('effective_date')
        classification.approval_status = "APPROVED"
        classification.save(update_fields=['approval_status'])
        return Response({"status": "Reclassification approved successfully."})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOfficer])
    def approve_discharge(self, request, pk=None):
        inmate = self.get_object()
        
        # 1. Verify health assessment for discharge is complete
        if not hasattr(inmate, 'discharge_health_assessment'):
            return Response(
                {"error": "Cannot approve discharge: Discharge Health assessment is missing."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 2. Find pending release record
        pending_releases = inmate.release_history.filter(approval_status="PENDING")
        if not pending_releases.exists():
            return Response({"error": "No pending discharge request found."}, status=status.HTTP_400_BAD_REQUEST)
        
        release = pending_releases.latest('id')
        release.approval_status = "APPROVED"
        release.save(update_fields=['approval_status'])
        
        # Update current status to discharged
        inmate.current_status = "DISCHARGED"
        inmate.save(update_fields=['current_status'])
        
        return Response({"status": "Discharge approved successfully."})


class NextOfKinViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = NextOfKin.objects.all()
    serializer_class = NextOfKinSerializer
    permission_classes = [IsAuthenticated]


class InmateStationHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmateStationHistory.objects.select_related("station", "inmate")
    serializer_class = InmateStationHistorySerializer
    permission_classes = [IsAuthenticated]


class InmateClassificationHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmateClassificationHistory.objects.select_related("inmate")
    serializer_class = InmateClassificationHistorySerializer
    permission_classes = [IsAuthenticated]


class OffenceViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Offence.objects.select_related("inmate")
    serializer_class = OffenceSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def record_court_session(self, request, pk=None):
        offence = self.get_object()
        serializer = CourtSessionCreateSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        outcome = data['outcome']
        
        with transaction.atomic():
            # 1. Save CourtSession
            CourtSession.objects.create(
                offence=offence,
                session_date=data['session_date'],
                outcome=outcome,
                next_court_date=data.get('next_court_date'),
                remarks=data.get('remarks')
            )
            
            inmate = offence.inmate
            
            if outcome == 'REMANDED':
                if hasattr(offence, 'unconviction') and offence.unconviction is not None:
                    offence.unconviction.next_court_date = data['next_court_date']
                    offence.unconviction.save()
            
            elif outcome == 'CONVICTED':
                # Preserve Unconvicted history, just set remand_end_date
                if hasattr(offence, 'unconviction') and offence.unconviction is not None:
                    if not offence.unconviction.remand_end_date:
                        offence.unconviction.remand_end_date = data.get('sentence_date') or data['session_date']
                        offence.unconviction.save()
                
                convicted, created = Convicted.objects.update_or_create(
                    offence=offence,
                    defaults={
                        'prison_number': inmate,
                        'sentence_years': data.get('sentence_years', 0),
                        'sentence_months': data.get('sentence_months', 0),
                        'sentence_days': data.get('sentence_days', 0),
                        'date_of_sentence': data.get('sentence_date'),
                        'has_fine': data.get('has_fine', False),
                        'fine_amount': data.get('fine_amount')
                    }
                )
                
                if data.get('has_restitution'):
                    Restitution.objects.update_or_create(
                        offence=offence,
                        defaults={
                            'inmate': inmate,
                            'restitution_amount': data.get('restitution_amount'),
                            'restitution_date': data.get('restitution_date'),
                            'restitution_sentence_years': data.get('restitution_sentence_years', 0),
                            'restitution_sentence_months': data.get('restitution_sentence_months', 0),
                            'restitution_sentence_days': data.get('restitution_sentence_days', 0),
                            'status': 'PENDING'
                        }
                    )
                
                offence.Offence_status = 'CONVICTED'
                offence.save()
                
            elif outcome == 'DISCHARGED':
                if hasattr(offence, 'unconviction') and offence.unconviction is not None:
                    if not offence.unconviction.remand_end_date:
                        offence.unconviction.remand_end_date = data['session_date']
                        offence.unconviction.save()
                    
                Discharged.objects.update_or_create(
                    offence=offence,
                    defaults={
                        'prison_number': inmate,
                        'discharge_reason': data.get('discharge_reason'),
                        'discharge_date': data['session_date'],
                        'remarks': data.get('remarks')
                    }
                )
                
                offence.Offence_status = 'DISCHARGED'
                offence.save()
                
                active_offences = inmate.offences.exclude(Offence_status='DISCHARGED').count()
                if active_offences == 0:
                    ReleaseWorkflow.objects.get_or_create(
                        inmate=inmate,
                        status="PROPOSED_BY_RECEPTION"
                    )
                    
            # Handle Reclassification
            reclassification = data.get('reclassification')
            if reclassification:
                current_class = inmate.classification_history.order_by('-effective_date').first()
                if not current_class or current_class.classification != reclassification:
                    InmateClassificationHistory.objects.create(
                        inmate=inmate,
                        classification=reclassification,
                        effective_date=timezone.now().date(),
                        approval_status='PENDING',
                        remarks='Proposed based on new court outcome'
                    )
                    InmateAuditTrail.objects.create(
                        inmate=inmate,
                        action=f"Proposed reclassification to {reclassification}",
                        performed_by=request.user.username if request.user else 'System'
                    )
            
            # Audit trail for the court session outcome
            InmateAuditTrail.objects.create(
                inmate=inmate,
                action=f"Recorded Court Session for '{offence.offence_description[:30]}': Outcome {outcome}",
                performed_by=request.user.username if request.user else 'System'
            )
                    
        return Response({"status": "Court session recorded successfully."})


class ConvictedViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Convicted.objects.select_related("offence")
    serializer_class = ConvictedSerializer
    permission_classes = [IsAuthenticated]


class UnconvictedViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Unconvicted.objects.select_related("inmate", "offence")
    serializer_class = UnconvictedSerializer
    permission_classes = [IsAuthenticated]


class RestitutionViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = Restitution.objects.select_related("inmate", "offence")
    serializer_class = RestitutionSerializer
    permission_classes = [IsAuthenticated]


class CourtSessionViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = CourtSession.objects.select_related("offence")
    serializer_class = CourtSessionSerializer
    permission_classes = [IsAuthenticated]


class RestitutionExtensionViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = RestitutionExtension.objects.select_related("restitution")
    serializer_class = RestitutionExtensionSerializer
    permission_classes = [IsAuthenticated]


# class ReleaseHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
#     queryset = ReleaseHistory.objects.select_related("inmate")
#     serializer_class = ReleaseHistorySerializer
#     permission_classes = [IsAuthenticated]


class InmatePropertyHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmatePropertyHistory.objects.select_related("inmate")
    serializer_class = InmatePropertyHistorySerializer
    permission_classes = [IsAuthenticated]


class EscapeHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = EscapeHistory.objects.select_related("inmate")
    serializer_class = EscapeHistorySerializer
    permission_classes = [IsAuthenticated]


class InmateDisciplinaryHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmateDisciplinaryHistory.objects.select_related("inmate")
    serializer_class = InmateDisciplinaryHistorySerializer
    permission_classes = [IsAuthenticated]


# class InmateMedicalHistoryViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
#     queryset = InmateMedicalHistory.objects.select_related("inmate")
#     serializer_class = InmateMedicalHistorySerializer
#     permission_classes = [IsAuthenticated]


class InmateDocumentViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmateDocument.objects.select_related("inmate")
    serializer_class = InmateDocumentSerializer
    permission_classes = [IsAuthenticated]


class InmateAuditTrailViewSet(OrgUnitContextMixin, viewsets.ModelViewSet):
    queryset = InmateAuditTrail.objects.select_related("inmate")
    serializer_class = InmateAuditTrailSerializer
    permission_classes = [IsAuthenticated]


# ==================================================
# COMPREHENSIVE REGISTRATION VIEW
# ==================================================

class InmateRegistrationView(APIView):
    """
    Comprehensive inmate registration endpoint.
    Handles complete inmate registration with all related data in a single atomic transaction.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Register a new inmate with all related information."""
        import logging
        logger = logging.getLogger(__name__)

        logger.info("=== INMATE REGISTRATION REQUEST RECEIVED ===")
        logger.info(f"User: {request.user.username if request.user else 'Anonymous'}")
        logger.info(f"Request data keys: {list(request.data.keys()) if request.data else 'None'}")

        # Log the incoming data structure
        for key, value in request.data.items():
            if isinstance(value, (list, dict)):
                logger.info(f"{key}: {type(value)} with {len(value) if hasattr(value, '__len__') else 'N/A'} items")
            else:
                logger.info(f"{key}: {value}")

        serializer = BasicInmateRegistrationSerializer(data=request.data, context={'request': request})

        logger.info("Running serializer validation...")
        if serializer.is_valid():
            logger.info("Serializer validation passed")
            try:
                logger.info("Calling serializer.save()...")
                inmate = serializer.save()
                logger.info(f"Serializer.save() completed. Inmate ID: {inmate.id}")

                response_serializer = InmateSerializer(inmate)
                logger.info("Registration completed successfully")
                return Response({
                    'success': True,
                    'message': 'Inmate registered successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Registration failed with exception: {str(e)}")
                logger.error(f"Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return Response({
                    'success': False,
                    'message': f'Registration failed: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.warning("Serializer validation failed")
        logger.warning(f"Validation errors: {serializer.errors}")

        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# ==================================================
# PENDING OFFENCE REGISTRATION VIEW
# ==================================================

class PendingAdminApprovalView(APIView):
    """
    View for inmates pending admin approval (have offences registered).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get inmates pending admin approval."""
        visible_org_units = getattr(request, 'visible_org_units', None)
        
        # Get inmates who have offences registered but are not yet confirmed
        inmates_with_offences = Inmate.objects.exclude(
            offences__isnull=True
        ).exclude(
            admission_status="ADMISSION_CONFIRMED"
        )
        
        if visible_org_units is not None:
            from django.db.models import Q
            inmates_with_offences = inmates_with_offences.filter(
                Q(owner_org_unit__in=visible_org_units) | Q(owner_org_unit__isnull=True)
            )
            
        inmates_with_offences = inmates_with_offences.order_by('-admission_date').distinct()

        data = []
        for inmate in inmates_with_offences:
            data.append({
                'id': inmate.id,
                'prison_number': inmate.prison_number,
                'name': f"{inmate.surname} {inmate.first_name}",
                'admission_date': inmate.admission_date,
                'offense': inmate.offences.first().offence_description[:50] if inmate.offences.exists() else 'N/A',
                'status': inmate.admission_status
            })

        return Response(data)


class PendingOffenceRegistrationView(APIView):
    """
    View for inmates who have completed basic registration but haven't registered offences yet.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get inmates pending offence registration."""
        visible_org_units = getattr(request, 'visible_org_units', None)
        
        # Get inmates who have no offences registered
        inmates_without_offences = Inmate.objects.filter(offences__isnull=True)
        
        if visible_org_units is not None:
            from django.db.models import Q
            inmates_without_offences = inmates_without_offences.filter(
                Q(owner_org_unit__in=visible_org_units) | Q(owner_org_unit__isnull=True)
            )
            
        inmates_without_offences = inmates_without_offences.order_by('-admission_date')

        data = []
        for inmate in inmates_without_offences:
            data.append({
                'id': inmate.id,
                'prison_number': inmate.prison_number,
                'name': f"{inmate.surname} {inmate.first_name}",
                'admission_date': inmate.admission_date,
                'status': 'pending_offence_registration'
            })

        return Response(data)


# ==================================================
# OFFENCE REGISTRATION VIEW
# ==================================================

class OffenceRegistrationView(APIView):
    """
    Offence registration endpoint for existing inmates.
    Handles offence details, conviction status, and related records.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Register offences for an existing inmate."""
        import logging
        logger = logging.getLogger(__name__)

        print("DEBUG VIEW: ====== OFFENCE REGISTRATION REQUEST RECEIVED ======")
        print(f"DEBUG VIEW: request.data = {request.data}")
        logger.info("=== OFFENCE REGISTRATION REQUEST RECEIVED ===")
        logger.info(f"User: {request.user.username if request.user else 'Anonymous'}")
        logger.info(f"Request data keys: {list(request.data.keys()) if request.data else 'None'}")

        # Log the incoming data structure
        for key, value in request.data.items():
            if isinstance(value, (list, dict)):
                logger.info(f"{key}: {type(value)} with {len(value) if hasattr(value, '__len__') else 'N/A'} items")
            else:
                logger.info(f"{key}: {value}")

        serializer = OffenceRegistrationSerializer(data=request.data, context={'request': request})

        logger.info("Running serializer validation...")
        if serializer.is_valid():
            logger.info("Serializer validation passed")
            print("DEBUG VIEW: Serializer validation passed")
            try:
                logger.info("Calling serializer.save()...")
                print("DEBUG VIEW: Calling serializer.save()...")
                inmate = serializer.save()
                logger.info(f"Serializer.save() completed. Inmate ID: {inmate.id}")
                print(f"DEBUG VIEW: Serializer.save() completed. Inmate ID: {inmate.id}")

                response_serializer = InmateSerializer(inmate)
                logger.info("Offence registration completed successfully")
                return Response({
                    'success': True,
                    'message': 'Offences registered successfully',
                    'data': response_serializer.data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Registration failed with exception: {str(e)}")
                logger.error(f"Exception type: {type(e).__name__}")
                print(f"DEBUG VIEW: Exception in serializer.save(): {str(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return Response({
                    'success': False,
                    'message': f'Offence registration failed: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.warning("Serializer validation failed")
        logger.warning(f"Validation errors: {serializer.errors}")
        print(f"DEBUG VIEW: Serializer validation failed! Errors: {serializer.errors}")

        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# ==================================================
# INMATE LISTING AND SEARCH VIEW
# ==================================================

class InmateListView(APIView):
    """
    Provides a list of inmates with search and filtering capabilities.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return a list of inmates, optionally filtered by query parameters.
        """
        from django.db.models import Q

        visible_org_units = getattr(request, 'visible_org_units', None)
        
        queryset = Inmate.objects.prefetch_related(
            'offences', 'classification_history'
        )
        
        if visible_org_units is not None:
            queryset = queryset.filter(
                Q(owner_org_unit__in=visible_org_units) | Q(owner_org_unit__isnull=True)
            )

        # Search functionality
        search_query = request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(prison_number__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(surname__icontains=search_query)
            )

        # Filtering by offence
        offence_query = request.query_params.get('offence', None)
        if offence_query:
            queryset = queryset.filter(offences__offence_description__icontains=offence_query)

        # Filtering by status (convicted/remand)
        status_query = request.query_params.get('status', None)
        if status_query:
            if status_query.lower() == 'convicted':
                queryset = queryset.filter(offences__Offence_status='CONVICTED')
            elif status_query.lower() == 'remand':
                queryset = queryset.filter(offences__Offence_status='UNCONVICTED')

        # Filtering by classification
        classification_query = request.query_params.get('classification', None)
        if classification_query:
            queryset = queryset.filter(classification_history__classification=classification_query)

        # Filtering by admission_status
        admission_status_query = request.query_params.get('admission_status', None)
        if admission_status_query:
            queryset = queryset.filter(admission_status=admission_status_query)

        # Ensure distinct results
        queryset = queryset.distinct()

        serializer = InmateListSerializer(queryset, many=True)
        return Response(serializer.data)


class UpcomingCourtSessionsView(OrgUnitContextMixin, APIView):
    """
    Returns a list of upcoming court sessions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only scheduled and remanded sessions typically have upcoming court dates
        queryset = CourtSession.objects.filter(
            outcome__in=["SCHEDULED", "REMANDED"],
            next_court_date__isnull=False
        ).select_related("offence__inmate").prefetch_related("offence__restitutions").order_by("next_court_date")
        
        # Apply org unit filtering if needed
        org_unit = getattr(request, 'org_unit', None)
        if org_unit:
            queryset = queryset.filter(offence__inmate__owner_org_unit=org_unit)

        serializer = UpcomingCourtSessionSerializer(queryset, many=True)
        return Response(serializer.data)


class ScheduleCourtSessionView(OrgUnitContextMixin, APIView):
    """
    Endpoint for scheduling a new court session and uploading a warrant.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ScheduleCourtSessionSerializer(data=request.data)
        if serializer.is_valid():
            offence_id = serializer.validated_data['offence_id']
            next_court_date = serializer.validated_data['next_court_date']
            remarks = serializer.validated_data.get('remarks')
            warrant_document = serializer.validated_data.get('warrant_document')

            try:
                offence = Offence.objects.get(id=offence_id)
            except Offence.DoesNotExist:
                return Response({"error": "Offence not found."}, status=status.HTTP_404_NOT_FOUND)

            with transaction.atomic():
                # Create the court session
                session = CourtSession.objects.create(
                    offence=offence,
                    session_date=next_court_date, # we will just use next court date for session_date since it's scheduled
                    outcome="SCHEDULED",
                    next_court_date=next_court_date,
                    remarks=remarks,
                    warrant_document=warrant_document
                )
                
                # Optionally, if they are unconvicted, update their next_court_date
                if hasattr(offence, 'unconviction') and offence.unconviction:
                    offence.unconviction.next_court_date = next_court_date
                    offence.unconviction.save()

            return Response({"message": "Court session scheduled successfully.", "id": session.id}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ReceptionAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        from django.utils import timezone
        import datetime
        from .models import Convicted

        now = timezone.now()
        today = now.date()
        thirty_days_ago = today - datetime.timedelta(days=30)
        seven_days_ahead = today + datetime.timedelta(days=7)

        # Base Inmate Queryset
        visible_org_units = getattr(request, 'visible_org_units', None)
        qs = Inmate.objects.all()
        if visible_org_units is not None:
            qs = qs.filter(Q(owner_org_unit__in=visible_org_units) | Q(owner_org_unit__isnull=True))

        # KPIs
        total_in_custody = qs.filter(current_status="IN_CUSTODY").count()
        admissions_this_month = qs.filter(admission_date__gte=thirty_days_ago).count()
        pending_admissions = qs.filter(admission_status__in=["PENDING_HEALTH_ASSESSMENT", "PENDING_ADMIN_APPROVAL"]).count()

        # Court Sessions next 7 days
        court_qs = CourtSession.objects.all()
        if visible_org_units is not None:
            court_qs = court_qs.filter(
                Q(offence__inmate__owner_org_unit__in=visible_org_units) | 
                Q(offence__inmate__owner_org_unit__isnull=True)
            )
        upcoming_courts = court_qs.filter(next_court_date__gte=today, next_court_date__lte=seven_days_ahead).count()

        # Status Distribution
        in_custody_qs = qs.filter(current_status="IN_CUSTODY")
        remand_count = in_custody_qs.filter(offences__Offence_status="UNCONVICTED").distinct().count()
        convicted_count = in_custody_qs.filter(offences__Offence_status="CONVICTED").distinct().count()

        status_distribution = [
            {"name": "Remand", "value": remand_count},
            {"name": "Convicted", "value": convicted_count}
        ]

        # Classification Distribution
        classification_counts = {}
        for inmate in in_custody_qs:
            latest_class = inmate.classification_history.filter(approval_status="APPROVED").order_by("-effective_date").first()
            cls = latest_class.classification if latest_class else "Unclassified"
            classification_counts[cls] = classification_counts.get(cls, 0) + 1
        
        classification_distribution = [{"name": k, "value": v} for k, v in classification_counts.items()]

        # Gender Demographics
        gender_counts = in_custody_qs.values("gender").annotate(count=Count("id"))
        gender_distribution = [{"name": g["gender"] or "Unknown", "value": g["count"]} for g in gender_counts]

        # Offences Breakdown
        offence_counts = Offence.objects.filter(inmate__in=in_custody_qs).values("offence_description").annotate(count=Count("id")).order_by("-count")[:10]
        offences_distribution = [{"name": o["offence_description"][:30] + ('...' if len(o["offence_description"]) > 30 else ''), "value": o["count"]} for o in offence_counts]

        # Sentences Period
        convictions = Convicted.objects.filter(offence__inmate__in=in_custody_qs)
        sentences_dist = {
            "< 1 Year": 0,
            "1-3 Years": 0,
            "3-5 Years": 0,
            "> 5 Years": 0
        }
        for c in convictions:
            years = (c.sentence_years or 0) + (c.sentence_months or 0)/12.0
            if years < 1:
                sentences_dist["< 1 Year"] += 1
            elif 1 <= years < 3:
                sentences_dist["1-3 Years"] += 1
            elif 3 <= years < 5:
                sentences_dist["3-5 Years"] += 1
            else:
                sentences_dist["> 5 Years"] += 1
        sentences_distribution = [{"name": k, "value": v} for k, v in sentences_dist.items() if v > 0]
        if not sentences_distribution:
            sentences_distribution = [{"name": "None", "value": 1}]

        # Admission Trends (Last 6 months)
        admission_trends = []
        for i in range(5, -1, -1):
            month_date = today.replace(day=1) - datetime.timedelta(days=30*i)
            month_start = month_date.replace(day=1)
            # handle december rollover for next month
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year+1, month=1)
            else:
                next_month = month_start.replace(month=month_start.month+1)
            
            month_end = next_month - datetime.timedelta(days=1)
            count = qs.filter(admission_date__gte=month_start, admission_date__lte=month_end).count()
            admission_trends.append({
                "month": month_start.strftime("%b %Y"),
                "admissions": count
            })

        return Response({
            "kpis": {
                "total_in_custody": total_in_custody,
                "admissions_this_month": admissions_this_month,
                "upcoming_courts": upcoming_courts,
                "pending_admissions": pending_admissions
            },
            "status_distribution": status_distribution,
            "classification_distribution": classification_distribution,
            "gender_distribution": gender_distribution,
            "offences_distribution": offences_distribution,
            "sentences_distribution": sentences_distribution,
            "admission_trends": admission_trends
        })

class UpcomingDischargesView(OrgUnitContextMixin, APIView):
    """
    Returns a list of upcoming discharges based on ReleaseHistory active_edr and active_odr.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .serializers import UpcomingDischargeSerializer
        from .models import ReleaseHistory
        
        # We only care about inmates currently in custody who have an active release history
        queryset = ReleaseHistory.objects.filter(
            inmate__current_status__in=["IN_CUSTODY", "TRANSFERRED"],
            active_edr__isnull=False
        ).select_related("inmate").prefetch_related("inmate__offences").order_by("active_edr")

        # Apply org unit filtering if needed
        org_unit = getattr(request, 'org_unit', None)
        if org_unit:
            queryset = queryset.filter(inmate__owner_org_unit=org_unit)

        serializer = UpcomingDischargeSerializer(queryset, many=True)
        return Response(serializer.data)
