"""
Reception app serializers
=========================
Professional DRF serializers for the inmate reception domain.
"""

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from datetime import datetime, date
from Auth.models import Station
from Auth.utils import get_current_station

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
    ReleaseHistory,
    # ReleaseHistory,
    InmatePropertyHistory,
    SentenceGroup,
    Discharged,
    ReleaseWorkflow,
    ArchivedDischarge,
    EscapeHistory,
    InmateDisciplinaryHistory,
    # InmateMedicalHistory,
    InmateDocument,
    InmateAuditTrail,
)


class InmateSerializer(serializers.ModelSerializer):
    """Core inmate serializer."""

    prison_number = serializers.CharField(required=False, allow_blank=True, validators=[])
    admission_date = serializers.DateField(default=timezone.now().date())
    has_discharge_assessment = serializers.SerializerMethodField()

    class Meta:
        model = Inmate
        fields = [
            "id",
            "prison_number",
            "crb_number",
            "first_name",
            "surname",
            "other_names",
            "national_id",
            "date_of_birth",
            "gender",
            "nationality",
            "address",
            "marital_status",
            "educational_level",
            "race",
            "headman",
            "chief",
            "district",
            "occupation",
            "is_first_time_offender",
            "inmate_image",
            "admission_type",
            "admission_date",
            "current_status",
            "admission_status",
            "has_discharge_assessment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_has_discharge_assessment(self, obj):
        return hasattr(obj, 'discharge_health_assessment')


class NextOfKinSerializer(serializers.ModelSerializer):
    inmate = serializers.IntegerField(required=False, write_only=True)  # Allow inmate ID for updates, but not required for creation

    class Meta:
        model = NextOfKin
        fields = ["full_name", "relationship", "address", "contact", "inmate"]
        read_only_fields = ["inmate"]  # Keep as read_only for creation
        # Exclude 'inmate' field as it's set during creation


class InmateStationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InmateStationHistory
        fields = "__all__"


class InmateClassificationHistorySerializer(serializers.ModelSerializer):
    inmate = serializers.IntegerField(required=False, write_only=True)
    effective_date = serializers.DateField(required=False, write_only=True)

    class Meta:
        model = InmateClassificationHistory
        fields = ["classification", "inmate", "effective_date"]
        read_only_fields = ["inmate", "effective_date"]


class OffenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offence
        fields = "__all__"


class CourtSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourtSession
        fields = "__all__"

class UpcomingCourtSessionSerializer(serializers.ModelSerializer):
    inmate_name = serializers.SerializerMethodField()
    prison_number = serializers.SerializerMethodField()
    offence_description = serializers.SerializerMethodField()
    offence_status = serializers.SerializerMethodField()
    restitution_status = serializers.SerializerMethodField()
    
    class Meta:
        model = CourtSession
        fields = [
            "id", "session_date", "outcome", "next_court_date", "remarks", 
            "warrant_document", "inmate_name", "prison_number", 
            "offence_description", "offence_status", "restitution_status", "offence_id"
        ]
        
    def get_inmate_name(self, obj):
        return f"{obj.offence.inmate.first_name} {obj.offence.inmate.surname}"
        
    def get_prison_number(self, obj):
        return obj.offence.inmate.prison_number
        
    def get_offence_description(self, obj):
        return obj.offence.offence_description
        
    def get_offence_status(self, obj):
        return obj.offence.Offence_status
        
    def get_restitution_status(self, obj):
        restitution = obj.offence.restitutions.first()
        if restitution:
            return restitution.status
        return "N/A"


class RestitutionExtensionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestitutionExtension
        fields = "__all__"


class ConvictedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Convicted
        fields = "__all__"


class UnconvictedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unconvicted
        fields = "__all__"


class RestitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restitution
        fields = "__all__"


# class ReleaseHistorySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = ReleaseHistory
#         fields = "__all__"


class InmatePropertyHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InmatePropertyHistory
        fields = "__all__"


class EscapeHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EscapeHistory
        fields = "__all__"


class InmateDisciplinaryHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InmateDisciplinaryHistory
        fields = "__all__"


# class InmateMedicalHistorySerializer(serializers.ModelSerializer):
#     class Meta:
#         model = InmateMedicalHistory
#         fields = "__all__"


class InmateDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = InmateDocument
        fields = "__all__"
        read_only_fields = ["uploaded_at"]


class InmateAuditTrailSerializer(serializers.ModelSerializer):
    class Meta:
        model = InmateAuditTrail
        fields = "__all__"
        read_only_fields = ["timestamp"]


class DischargedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discharged
        fields = "__all__"

class ReleaseWorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReleaseWorkflow
        fields = "__all__"

class ArchivedDischargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArchivedDischarge
        fields = "__all__"

class CourtSessionCreateSerializer(serializers.Serializer):
    session_date = serializers.DateField()
    outcome = serializers.ChoiceField(choices=CourtSession.OUTCOME_CHOICES)
    next_court_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    # Conviction fields
    sentence_months = serializers.IntegerField(required=False, allow_null=True)
    sentence_date = serializers.DateField(required=False, allow_null=True)

    # Discharge fields
    discharge_reason = serializers.ChoiceField(choices=Discharged.DISCHARGE_REASON_CHOICES, required=False, allow_null=True)

    def validate(self, data):
        outcome = data.get("outcome")
        if outcome in ["REMANDED", "SCHEDULED"]:
            if not data.get("next_court_date"):
                raise serializers.ValidationError({"next_court_date": f"Next court date is required when {outcome.lower()}."})
        elif outcome == "CONVICTED":
            if data.get("sentence_months") is None:
                raise serializers.ValidationError({"sentence_months": "Sentence duration is required for convictions."})
            if not data.get("sentence_date"):
                raise serializers.ValidationError({"sentence_date": "Sentence date is required for convictions."})
        elif outcome == "DISCHARGED":
            if not data.get("discharge_reason"):
                raise serializers.ValidationError({"discharge_reason": "Discharge reason is required."})
        return data

class ScheduleCourtSessionSerializer(serializers.Serializer):
    offence_id = serializers.IntegerField()
    next_court_date = serializers.DateField()
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    warrant_document = serializers.FileField(required=True, allow_null=False, error_messages={
        'required': "Uploading a court warrant/request document is mandatory.",
        'null': "Court warrant/request document cannot be null."
    })


class ComprehensiveInmateSerializer(serializers.ModelSerializer):
    """Comprehensive inmate serializer with all related data."""

    next_of_kin = serializers.SerializerMethodField()
    classification = serializers.SerializerMethodField()
    valuables = serializers.SerializerMethodField()
    offences = serializers.SerializerMethodField()
    release_history = serializers.SerializerMethodField()
    station_history = InmateStationHistorySerializer(read_only=True, many=True)

    class Meta:
        model = Inmate
        fields = [
            "id", "prison_number", "crb_number", "first_name", "surname", "other_names",
            "national_id", "date_of_birth", "gender", "nationality", "admission_type",
            "admission_date", "current_status", "created_at", "updated_at",
            "next_of_kin", "classification", "valuables", "offences", "release_history", "station_history"
        ]

    def get_valuables(self, obj):
        """Get inmate's valuables."""
        valuables = InmatePropertyHistory.objects.filter(inmate=obj).first()
        if valuables:
            return {
                'id': valuables.id,
                'bag_number': valuables.bag_number,
                'cash_amount': valuables.cash_amount,
                'items_description': valuables.items_description,
                'date_logged': valuables.date_logged,
            }
        return None

    def get_next_of_kin(self, obj):
        """Get inmate's next of kin."""
        next_of_kin = obj.next_of_kin.first()
        if next_of_kin:
            return NextOfKinSerializer(next_of_kin).data
        return None

    def get_classification(self, obj):
        """Get inmate's current classification."""
        classification = obj.classification_history.first()
        if classification:
            return InmateClassificationHistorySerializer(classification).data
        return None

    def get_release_history(self, obj):
        """Get the inmate's release history."""
        release_history = obj.release_history.first()
        if release_history:
            return {
                'total_effective_sentence': release_history.total_effective_sentence,
                'total_sentences_days': release_history.total_sentences_days,
                'remission': release_history.remission,
                'total_remission_days': release_history.total_remission_days,
                'earliest_date_of_release': release_history.earliest_date_of_release,
                'active_edr': release_history.active_edr,
                'active_odr': release_history.active_odr,
                'edr_standard': release_history.edr_standard,
                'odr_standard': release_history.odr_standard,
                'edr_restitution_paid': release_history.edr_restitution_paid,
                'odr_restitution_paid': release_history.odr_restitution_paid,
            }
        return None

    def get_offences(self, obj):
        """Get inmate's offences with related data."""
        offences = []
        for offence in obj.offences.all():
            offence_data = {
                'id': offence.id,
                'offence_description': offence.offence_description,
                'court': offence.court,
                'conviction_status': offence.Offence_status.lower(),
            }

            if hasattr(offence, 'conviction') and offence.conviction:
                convicted = offence.conviction
                offence_data.update({
                    'sentence': convicted.sentence,
                    'sentence_years': convicted.sentence_years,
                    'sentence_months': convicted.sentence_months,
                    'sentence_days': convicted.sentence_days,
                    'effective_sentence_days': convicted.effective_sentence_days,
                    'remission_days': convicted.remission_days,
                    'sentence_date': convicted.date_of_sentence,
                })
                # Add restitution if exists
                restitution = offence.restitutions.first()
                if restitution:
                    offence_data.update({
                        'restitution_amount': restitution.restitution_amount,
                        'restitution_date': restitution.restitution_date,
                        'restitution_sentence_years': restitution.restitution_sentence_years,
                        'restitution_sentence_months': restitution.restitution_sentence_months,
                        'restitution_sentence_days': restitution.restitution_sentence_days,
                        'restitution_sentence_days_total': restitution.restitution_sentence_days_total,
                        'restitution_status': restitution.status,
                    })
            elif hasattr(offence, 'unconviction') and offence.unconviction:
                unconvicted = offence.unconviction
                offence_data.update({
                    'next_court_date': unconvicted.next_court_date,
                    'remand_start_date': unconvicted.remand_start_date,
                    'remand_end_date': unconvicted.remand_end_date,
                })
            
            # Include court session history
            offence_data['court_history'] = CourtSessionSerializer(offence.court_sessions.all(), many=True).data

            offences.append(offence_data)

        return offences


# ==================================================
# COMPREHENSIVE REGISTRATION SERIALIZER
# ==================================================

class FlexibleDateField(serializers.DateField):
    """DateField that accepts empty strings as None."""
    def to_internal_value(self, value):
        if value == '' or value is None:
            return None
        return super().to_internal_value(value)


class OffenceDataSerializer(serializers.Serializer):
    """Serializer for offence data during registration."""
    offence = serializers.CharField(max_length=1000)
    convictionStatus = serializers.ChoiceField(choices=['convicted', 'unconvicted'])
    furtherCharge = serializers.CharField(max_length=500, required=False, allow_blank=True)
    court = serializers.CharField(max_length=100)
    sentence = serializers.CharField(max_length=50, required=False, allow_blank=True)
    sentenceYears = serializers.IntegerField(default=0, required=False)
    sentenceMonths = serializers.IntegerField(default=0, required=False)
    sentenceDays = serializers.IntegerField(default=0, required=False)
    sentenceDate = FlexibleDateField(required=False, allow_null=True, input_formats=["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "iso-8601"])
    remission = serializers.CharField(max_length=50, required=False, allow_blank=True)
    nextCourtDate = FlexibleDateField(required=False, allow_null=True, input_formats=["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "iso-8601"])
    remandStartDate = FlexibleDateField(required=False, allow_null=True, input_formats=["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "iso-8601"])

    def validate(self, data):
        """Validate offence data based on conviction status."""
        conviction_status = data.get('convictionStatus')

        if conviction_status == 'convicted':
            # Note: For convicted offences, sentence and sentenceDate are now conditionally 
            # required based on whether they are grouped. The frontend handles this validation.
            
            # Clear unconvicted fields
            data['nextCourtDate'] = None
            
        elif conviction_status == 'unconvicted':
            # For unconvicted offences, require next court date
            if not data.get('nextCourtDate'):
                raise serializers.ValidationError({'nextCourtDate': 'This field is required for unconvicted offences.'})
            
            # Clear convicted fields
            data['sentence'] = ''
            data['sentenceDate'] = None
            data['remission'] = ''

        return data


class RestitutionRegistrationSerializer(serializers.Serializer):
    """Serializer for restitution data during registration."""
    offenceIndex = serializers.IntegerField(min_value=0)
    restitutionAmount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    restitutionDate = FlexibleDateField()
    restitutionSentence = serializers.CharField(max_length=500, required=False, allow_blank=True)
    restitutionSentenceYears = serializers.IntegerField(default=0, required=False)
    restitutionSentenceMonths = serializers.IntegerField(default=0, required=False)
    restitutionSentenceDays = serializers.IntegerField(default=0, required=False)
    restitutionStatus = serializers.ChoiceField(choices=['pending', 'partial', 'paid', 'waived'], default='pending')
    earliestDateOfReleaseWithRestitution = FlexibleDateField(required=False, allow_null=True)
    restitutionReceipt = serializers.FileField(required=False, allow_null=True)


class InmateValuablesRegistrationSerializer(serializers.Serializer):
    """Serializer for inmate valuables during registration."""
    bagNo = serializers.CharField(max_length=50, required=False, allow_blank=True)
    cash = serializers.CharField(required=False, allow_blank=True)
    tShirt = serializers.CharField(required=False, allow_blank=True)
    tShirtColor = serializers.CharField(required=False, allow_blank=True)
    shorts = serializers.CharField(required=False, allow_blank=True)
    shortsColor = serializers.CharField(required=False, allow_blank=True)
    skirt = serializers.CharField(required=False, allow_blank=True)
    skirtColor = serializers.CharField(required=False, allow_blank=True)
    dress = serializers.CharField(required=False, allow_blank=True)
    dressColor = serializers.CharField(required=False, allow_blank=True)
    cap = serializers.CharField(required=False, allow_blank=True)
    capColor = serializers.CharField(required=False, allow_blank=True)
    blouse = serializers.CharField(required=False, allow_blank=True)
    blouseColor = serializers.CharField(required=False, allow_blank=True)
    shoes = serializers.CharField(required=False, allow_blank=True)
    shoesColor = serializers.CharField(required=False, allow_blank=True)
    socks = serializers.CharField(required=False, allow_blank=True)
    socksColor = serializers.CharField(required=False, allow_blank=True)
    jersey = serializers.CharField(required=False, allow_blank=True)
    jerseyColor = serializers.CharField(required=False, allow_blank=True)
    wallet = serializers.CharField(required=False, allow_blank=True)
    walletColor = serializers.CharField(required=False, allow_blank=True)
    wallets = serializers.CharField(required=False, allow_blank=True)
    walletsColor = serializers.CharField(required=False, allow_blank=True)
    others = serializers.CharField(max_length=500, required=False, allow_blank=True)


class BasicInmateRegistrationSerializer(serializers.Serializer):
    """
    Basic inmate registration serializer.
    Handles inmate details, next of kin, classification, and valuables.
    Offences are registered separately.
    """

    # Inmate Details
    inmateDetails = InmateSerializer()

    # Next of Kin
    nextOfKin = serializers.DictField(required=False, default=dict)

    # Classification
    classification = serializers.DictField(required=False, default=dict)

    # Valuables
    inmateValuables = InmateValuablesRegistrationSerializer(required=False, default=dict)

    def validate(self, data):
        """Basic validation for inmate registration."""
        import logging
        logger = logging.getLogger(__name__)

        logger.info("=== STARTING BASIC INMATE VALIDATION ===")

        inmate_data = data.get('inmateDetails', {})

        logger.info(f"Validating inmate data: {inmate_data.get('first_name', 'N/A')} {inmate_data.get('surname', 'N/A')}")

        # Validate inmate basic data
        if inmate_data.get('date_of_birth') and inmate_data.get('admission_date'):
            logger.info(f"Validating dates: DOB={inmate_data['date_of_birth']}, Admission={inmate_data['admission_date']}")
            if inmate_data['date_of_birth'] >= inmate_data['admission_date']:
                logger.warning("Date validation failed: DOB >= Admission Date")
                raise serializers.ValidationError({
                    'inmateDetails': {
                        'date_of_birth': 'Date of birth must be before admission date'
                    }
                })
            logger.info("Date validation passed")

        # Validate national ID format if provided
        national_id = inmate_data.get('national_id')
        if national_id:
            logger.info(f"Validating national ID: {national_id}")
            import re
            if not re.match(r'^[0-9]{2}-[0-9]{6,7}\s?[A-Z]\s?[0-9]{2}$', national_id):
                logger.warning(f"National ID validation failed: {national_id}")
                raise serializers.ValidationError({
                    'inmateDetails': {
                        'national_id': 'Invalid National ID format. Must be XX-XXXXXXX A XX'
                    }
                })
            logger.info("National ID validation passed")

        logger.info("=== BASIC VALIDATION COMPLETED SUCCESSFULLY ===")
        return data

    @transaction.atomic
    def create(self, validated_data):
        """Create all related records in a single atomic transaction."""
        from Auth.utils import get_current_station
        import logging

        logger = logging.getLogger(__name__)

        logger.info("=== STARTING INMATE REGISTRATION PROCESS ===")

        # Extract nested data
        inmate_data = validated_data.pop('inmateDetails')
        next_of_kin_data = validated_data.pop('nextOfKin', {})
        classification_data = validated_data.pop('classification', {})
        valuables_data = validated_data.pop('inmateValuables', {})

        logger.info(f"Inmate data: {inmate_data}")
        logger.info(f"Next of kin data: {next_of_kin_data}")

        # Get current user's station and org unit (Phase 1)
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            station = get_current_station(request.user)
            logger.info(f"User station: {station} (ID: {station.id if station else None})")
            org_unit = getattr(request, 'org_unit', None)
            if not org_unit:
                from Auth.utils import get_current_org_unit
                org_unit = get_current_org_unit(request.user)
        else:
            # Fallback - this should not happen in production
            logger.warning("No request context, using fallback station")
            station = Station.objects.filter(active=True).first()
            if not station:
                logger.error("No active station found")
                raise serializers.ValidationError("No active station found")

        logger.info("Creating inmate record...")
        # Create inmate with owner org unit
        create_kwargs = inmate_data.copy()
        if 'org_unit' not in create_kwargs:
            try:
                create_kwargs['owner_org_unit'] = org_unit
            except UnboundLocalError:
                create_kwargs['owner_org_unit'] = None

        inmate = Inmate.objects.create(**create_kwargs)
        logger.info(f"Inmate created with ID: {inmate.id}, Prison Number: {inmate.prison_number}")

        # Create next of kin only when the optional section has content.
        next_of_kin_required = ["full_name", "relationship", "address", "contact"]
        if all(str(next_of_kin_data.get(field, "")).strip() for field in next_of_kin_required):
            logger.info("Creating next of kin record...")
            next_of_kin_data['inmate'] = inmate
            next_of_kin = NextOfKin.objects.create(**next_of_kin_data)
            logger.info(f"Next of kin created with ID: {next_of_kin.id}")

        # Create station history
        logger.info("Creating station history record...")
        station_history = InmateStationHistory.objects.create(
            inmate=inmate,
            station=station,
            date_admitted=inmate.admission_date,
            reason="NEW_ADMISSION"
        )
        logger.info(f"Station history created with ID: {station_history.id}")

        # Create classification history only when selected.
        classification_value = classification_data.get("classification")
        if classification_value:
            logger.info("Creating classification history record...")
            classification = InmateClassificationHistory.objects.create(
                inmate=inmate,
                classification=classification_value,
                effective_date=inmate.admission_date,
                remarks=classification_data.get("reason") or classification_data.get("authorizedBy") or None,
            )
            logger.info(f"Classification history created with ID: {classification.id}")

        # Create valuables record only when the optional section has content.
        has_valuables = any(str(value).strip() for value in valuables_data.values() if value is not None)
        if has_valuables:
            logger.info("Creating valuables record...")

            bag_number = valuables_data.get('bagNo', '').strip()
            cash_str = valuables_data.get('cash', '').strip()

            clothing_fields = [
                ("shorts", "shortsColor", "Short"),
                ("tShirt", "tShirtColor", "T-shirts"),
                ("skirt", "skirtColor", "Skirt"),
                ("dress", "dressColor", "Dress"),
                ("cap", "capColor", "Cap"),
                ("blouse", "blouseColor", "Blouse"),
                ("shoes", "shoesColor", "Shoes"),
                ("wallet", "walletColor", "Wallet"),
                ("jersey", "jerseyColor", "Jersey"),
                ("wallets", "walletsColor", "Wallets"),
                ("socks", "socksColor", "Socks"),
            ]

            items = []
            for item_field, color_field, label in clothing_fields:
                if valuables_data.get(item_field) and str(valuables_data[item_field]).strip():
                    color = valuables_data.get(color_field, '').strip()
                    desc = label
                    if color:
                        desc += f" ({color})"
                    items.append(desc)

            others = valuables_data.get('others', '').strip()
            if others:
                items.append(f"Others: {others}")

            valuables = InmatePropertyHistory.objects.create(
                inmate=inmate,
                bag_number=bag_number,
                cash_amount=float(cash_str) if cash_str else 0,
                items_description='; '.join(items) if items else 'No items',
                date_logged=inmate.admission_date,
            )
            logger.info(f"Valuables record created with ID: {valuables.id}")

        # Create audit trail
        logger.info("Creating audit trail...")
        try:
            audit = InmateAuditTrail.objects.create(
                inmate=inmate,
                action="BASIC_INMATE_REGISTERED",
                performed_by=request.user.username if request and request.user else "SYSTEM",
                remarks="Basic inmate registration completed"
            )
            logger.info(f"Audit trail created with ID: {audit.id}")
        except Exception as e:
            logger.error(f"Error creating audit trail: {e}")
            raise

        logger.info(f"=== BASIC INMATE REGISTRATION COMPLETED SUCCESSFULLY ===")
        logger.info(f"Final inmate ID: {inmate.id}, Prison Number: {inmate.prison_number}")

        return inmate


# ==================================================
# OFFENCE REGISTRATION SERIALIZER
# ==================================================

class OffenceRegistrationSerializer(serializers.Serializer):
    """
    Offence registration serializer for existing inmates.
    Handles offence details, conviction status, and related records.
    """

    inmate_id = serializers.IntegerField()

    # Offences (array)
    offences = serializers.ListField(
        child=OffenceDataSerializer(),
        min_length=1,
        max_length=20  # Reasonable limit
    )

    # Release Dates (optional, only for convicted offences)
    # Using DictField without child to allow mixed types (strings/dates)
    releaseDates = serializers.DictField(required=False, default=dict)

    # Sentence Grouping (optional)
    sentenceGroup = serializers.DictField(required=False, default=dict)

    # Restitutions (array, optional, only for convicted offences)
    restitutions = serializers.ListField(
        child=RestitutionRegistrationSerializer(),
        required=False,
        default=list
    )

    def validate(self, data):
        """Validation for offence registration."""
        import logging
        logger = logging.getLogger(__name__)

        logger.info("=== STARTING OFFENCE REGISTRATION VALIDATION ===")

        inmate_id = data.get('inmate_id')
        offences_data = data.get('offences', [])
        restitutions_data = data.get('restitutions', [])

        # Validate inmate exists
        try:
            inmate = Inmate.objects.get(id=inmate_id)
            logger.info(f"Validating offences for inmate: {inmate.prison_number} - {inmate.surname} {inmate.first_name}")
        except Inmate.DoesNotExist:
            raise serializers.ValidationError({'inmate_id': 'Inmate not found'})

        logger.info(f"Number of offences to validate: {len(offences_data)}")
        logger.info(f"Number of restitutions to validate: {len(restitutions_data)}")

        # Validate offences
        convicted_count = sum(1 for offence in offences_data if offence.get('convictionStatus') == 'convicted')
        unconvicted_count = sum(1 for offence in offences_data if offence.get('convictionStatus') == 'unconvicted')

        logger.info(f"Offence counts: Convicted={convicted_count}, Unconvicted={unconvicted_count}, Total={len(offences_data)}")

        if convicted_count + unconvicted_count != len(offences_data):
            logger.warning("Offence status validation failed: missing or invalid conviction statuses")
            raise serializers.ValidationError({
                'offences': 'All offences must have a valid conviction status'
            })

        # Validate restitutions are only for convicted offences
        logger.info("Validating restitutions...")
        for i, restitution in enumerate(restitutions_data):
            offence_index = restitution.get('offenceIndex', -1)
            logger.info(f"Validating restitution {i+1}: offence_index={offence_index}")
            if 0 <= offence_index < len(offences_data):
                offence = offences_data[offence_index]
                if offence.get('convictionStatus') != 'convicted':
                    logger.warning(f"Restitution validation failed: offence at index {offence_index} is not convicted")
                    raise serializers.ValidationError({
                        'restitutions': f'Restitution can only be added for convicted offences. Offence at index {offence_index} is unconvicted.'
                    })
            else:
                logger.warning(f"Restitution validation failed: invalid offence index {offence_index}")
                raise serializers.ValidationError({
                    'restitutions': f'Invalid offence index {offence_index} in restitution'
                })

        # Validate release dates are only provided for convicted offences
        release_dates_data = data.get('releaseDates', {})
        if release_dates_data and convicted_count > 0:
            # Check earliestDateOfRelease format
            edr = release_dates_data.get('earliestDateOfRelease')
            if edr:
                # Try to parse date manually since we removed the child=DateField
                import datetime
                if isinstance(edr, str) and edr.strip():
                    try:
                        # Try common formats
                        parsed = False
                        for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"]:
                            try:
                                datetime.datetime.strptime(edr, fmt)
                                parsed = True
                                break
                            except ValueError:
                                continue
                        
                        # Also check ISO format (YYYY-MM-DD...)
                        if not parsed:
                            try:
                                datetime.date.fromisoformat(edr[:10]) # First 10 chars for YYYY-MM-DD
                                parsed = True
                            except ValueError:
                                pass
                        
                        if not parsed:
                             raise serializers.ValidationError({'releaseDates': {'earliestDateOfRelease': 'Invalid date format'}})
                    except Exception:
                         raise serializers.ValidationError({'releaseDates': {'earliestDateOfRelease': 'Invalid date format'}})
            
            # Note: We ignore other fields like 'sentence' in releaseDates as they are not dates

        # Note: Individual offence validation is handled by OffenceDataSerializer
        # The OffenceDataSerializer already validates required fields based on conviction status
        # and clears irrelevant fields, so we don't need additional validation here
        logger.info("Offence validation completed by OffenceDataSerializer")

        logger.info("=== OFFENCE REGISTRATION VALIDATION COMPLETED SUCCESSFULLY ===")
        return data

    @transaction.atomic
    def create(self, validated_data):
        """Create offence records and related data for existing inmate."""
        import logging
        logger = logging.getLogger(__name__)
        
        print("DEBUG: ====== STARTING OFFENCE CREATION IN SERIALIZER ======")
        print(f"DEBUG: validated_data keys: {validated_data.keys()}")
        print(f"DEBUG: offences_data count: {len(validated_data.get('offences', []))}")
        print(f"DEBUG: raw validated_data: {validated_data}")
        logger.info("=== STARTING OFFENCE CREATION ===")
        logger.info(f"Validated data: {validated_data}")

        inmate_id = validated_data.get('inmate_id')
        offences_data = validated_data.get('offences', [])
        restitutions_data = validated_data.get('restitutions', [])
        release_dates_data = validated_data.get('releaseDates', {})

        # Get the inmate
        try:
            inmate = Inmate.objects.get(id=inmate_id)
        except Inmate.DoesNotExist:
            raise serializers.ValidationError(f"Inmate with id {inmate_id} does not exist.")

        # Helper function to parse dates
        def parse_date(date_val):
            if not date_val:
                return None
            if isinstance(date_val, date):
                return date_val
            try:
                # Try ISO format first (YYYY-MM-DD)
                return datetime.strptime(str(date_val)[:10], "%Y-%m-%d").date()
            except ValueError:
                # Try other formats if needed
                for fmt in ["%d-%m-%Y", "%Y/%m/%d"]:
                    try:
                        return datetime.strptime(str(date_val), fmt).date()
                    except ValueError:
                        continue
            return None

        processed_offences = []

        sentence_group_data = validated_data.get('sentenceGroup', {})
        sentence_group_instance = None
        is_grouped = sentence_group_data.get('isGrouped', False)
        
        print("DEBUG: ====== STARTING OFFENCE CREATION ======")
        print(f"DEBUG: Inmate ID: {inmate_id}")
        print(f"DEBUG: Number of offences to process: {len(offences_data)}")
        print(f"DEBUG: Is Grouped Sentence? {is_grouped}")

        if is_grouped and any(o['convictionStatus'] == 'convicted' for o in offences_data):
            sg_duration_str = str(sentence_group_data.get('duration', '0'))
            try:
                sg_duration = int(sg_duration_str.split()[0])
            except (ValueError, IndexError):
                sg_duration = 0
            
            sg_date = parse_date(sentence_group_data.get('date')) or timezone.now().date()
            
            print(f"DEBUG: Creating SentenceGroup (Duration: {sg_duration} months, Date: {sg_date})")
            sentence_group_instance = SentenceGroup.objects.create(
                inmate=inmate,
                date_of_sentence=sg_date,
                duration_months=sg_duration,
                is_concurrent=True
            )
            print(f"DEBUG: Created SentenceGroup ID: {sentence_group_instance.id}")

        # Process offences and related records (Create or Update)
        logger.info("Processing offences...")
        for i, offence_data in enumerate(offences_data):
            offence_id = offence_data.get('id')
            is_update = bool(offence_id)
            print(f"DEBUG: Processing Offence #{i+1} (Update? {is_update}): {offence_data['offence']}")

            # Use sentenceDate for date_charged if available, else today for new offences
            date_charged = offence_data.get('sentenceDate') or timezone.now().date()
            
            if is_update:
                try:
                    offence = Offence.objects.get(id=offence_id, inmate=inmate)
                    offence.offence_description = offence_data['offence']
                    offence.court = offence_data['court']
                    offence.date_charged = date_charged # Update date_charged as well
                    offence.Offence_status = 'CONVICTED' if offence_data['convictionStatus'] == 'convicted' else 'UNCONVICTED'
                    offence.save()
                    print(f"DEBUG: Successfully UPDATED Offence ID: {offence.id} in database")
                except Offence.DoesNotExist:
                    print(f"DEBUG: ERROR - Offence with id {offence_id} not found!")
                    raise serializers.ValidationError(f"Offence with id {offence_id} not found for this inmate.")
            else:
                offence = Offence.objects.create(
                    inmate=inmate,
                    offence_description=offence_data['offence'],
                    court=offence_data['court'],
                    date_charged=date_charged,
                    Offence_status='CONVICTED' if offence_data['convictionStatus'] == 'convicted' else 'UNCONVICTED'
                )
                print(f"DEBUG: Successfully CREATED Offence ID: {offence.id} in database")
            
            processed_offences.append(offence)

            if offence_data['convictionStatus'] == 'convicted':
                # Create or update convicted record
                logger.info(f"Processing convicted record for offence {offence.id}")
                try:
                    sentence_date = parse_date(offence_data.get('sentenceDate'))
                    if sentence_group_instance:
                        sentence_date = sentence_group_instance.date_of_sentence

                    sentence_years = offence_data.get('sentenceYears', 0)
                    sentence_months = offence_data.get('sentenceMonths', 0)
                    sentence_days = offence_data.get('sentenceDays', 0)

                    convicted, created = Convicted.objects.update_or_create(
                        offence=offence,
                        defaults={
                            'prison_number': inmate,
                            'date_of_sentence': sentence_date,
                            'sentence_years': sentence_years,
                            'sentence_months': sentence_months,
                            'sentence_days': sentence_days,
                            'sentence_group': sentence_group_instance,
                        }
                    )
                    action = "created" if created else "updated"
                    logger.info(f"Convicted record {action} with ID: {convicted.pk}")
                except Exception as e:
                    logger.error(f"Error processing convicted record: {e}")
                    raise

                # Ensure no unconvicted record exists for this offence
                Unconvicted.objects.filter(offence=offence).delete()

            else:
                # Create or update unconvicted record
                logger.info(f"Processing unconvicted record for offence {offence.id}")
                try:
                    unconvicted, created = Unconvicted.objects.update_or_create(
                        offence=offence,
                        defaults={
                            'prison_number': inmate,
                            'next_court_date': parse_date(offence_data['nextCourtDate']),
                            'remand_start_date': parse_date(offence_data.get('remandStartDate')) or date_charged
                        }
                    )
                    action = "created" if created else "updated"
                    logger.info(f"Unconvicted record {action} with ID: {unconvicted.pk}")
                    
                    if unconvicted.next_court_date:
                        CourtSession.objects.get_or_create(
                            offence=offence,
                            session_date=unconvicted.next_court_date,
                            outcome='SCHEDULED',
                            defaults={'next_court_date': unconvicted.next_court_date}
                        )
                except Exception as e:
                    logger.error(f"Error processing unconvicted record: {e}")
                    raise

                # Ensure no convicted record exists for this offence
                Convicted.objects.filter(offence=offence).delete()

        # Process restitutions (only for created/updated offences in this payload)
        # For simplicity, we delete old restitutions for updated offences and recreate them.
        # A more complex approach would be to update them individually.
        logger.info("Processing restitutions...")
        for i, restitution_data in enumerate(restitutions_data):
            logger.info(f"Processing restitution {i+1}: {restitution_data}")
            offence_index = restitution_data.pop('offenceIndex')
            
            if 0 <= offence_index < len(processed_offences):
                offence = processed_offences[offence_index]
                logger.info(f"Linking restitution to offence ID: {offence.id} (index: {offence_index})")

                # Delete existing restitutions for this offence to avoid duplicates on update
                Restitution.objects.filter(offence=offence).delete()

                try:
                    # Map frontend camelCase keys to backend snake_case keys
                    mapped_data = {
                        'restitution_amount': restitution_data.get('restitutionAmount'),
                        'restitution_date': parse_date(restitution_data.get('restitutionDate')),
                        'alternative_restitution_sentence': restitution_data.get('restitutionSentence'),
                        'restitution_sentence_years': restitution_data.get('restitutionSentenceYears', 0),
                        'restitution_sentence_months': restitution_data.get('restitutionSentenceMonths', 0),
                        'restitution_sentence_days': restitution_data.get('restitutionSentenceDays', 0),
                        'status': restitution_data.get('restitutionStatus'),
                        'receipt': restitution_data.get('restitutionReceipt')
                    }

                    restitution = Restitution.objects.create(
                        offence=offence,
                        inmate=inmate,
                        **mapped_data
                    )
                    
                    if restitution.restitution_date:
                        CourtSession.objects.get_or_create(
                            offence=offence,
                            session_date=restitution.restitution_date,
                            outcome='SCHEDULED',
                            defaults={'next_court_date': restitution.restitution_date}
                        )

                    logger.info(f"Restitution created with ID: {restitution.id}")
                except Exception as e:
                    logger.error(f"Error creating restitution: {e}")
                    raise
            else:
                logger.warning(f"Invalid offence index for restitution: {offence_index}. Skipping.")

        # Note: Release History is automatically updated via post_save signals on Convicted and Restitution models.

        # Return the inmate instance so the view can serialize and respond
        return inmate



# ==================================================
# INMATE LISTING SERIALIZER
# ==================================================

class InmateListSerializer(serializers.ModelSerializer):
    """Serializer for listing inmates with key summary data."""
    name = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    offense = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    classification = serializers.SerializerMethodField()

    class Meta:
        model = Inmate
        fields = [
            'id', 'prison_number', 'name', 'age',
            'gender', 'admission_date',
            'offense', 'status', 'classification',
            'admission_status'
        ]

    def get_name(self, obj):
        return f"{obj.first_name} {obj.surname}".strip()

    def get_age(self, obj):
        from datetime import date
        if obj.date_of_birth:
            today = date.today()
            return today.year - obj.date_of_birth.year - ((today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day))
        return 0

    def get_offense(self, obj):
        """Return a comma-separated list of offence descriptions."""
        return ", ".join([offence.offence_description for offence in obj.offences.all()])

    def get_status(self, obj):
        """Determine the inmate's overall status based on their admission status and current status."""
        if obj.current_status == "DISCHARGED":
            return "discharged"
        if obj.current_status == "TRANSFERRED":
            return "transferred"
            
        if obj.admission_status in ["PENDING_HEALTH_ASSESSMENT", "PENDING_ADMIN_APPROVAL"]:
            return "pending"
            
        return "active"

    def get_classification(self, obj):
        """Get the inmate's most recent classification."""
        latest_classification = obj.classification_history.order_by('-effective_date').first()
        return latest_classification.classification if latest_classification else 'N/A'

