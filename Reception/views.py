from rest_framework import viewsets, status
from Core.mixins import OrgUnitContextMixin

from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

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
    # ReleaseHistorySerializer,
    InmatePropertyHistorySerializer,
    EscapeHistorySerializer,
    InmateDisciplinaryHistorySerializer,
    # InmateMedicalHistorySerializer,
    InmateDocumentSerializer,
    InmateAuditTrailSerializer,
    InmateListSerializer,
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
        
        # Get inmates who have offences registered (pending final approval)
        inmates_with_offences = Inmate.objects.exclude(
            offences__isnull=True
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
                'status': 'pending_approval'
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
