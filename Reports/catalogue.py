"""
Report catalogue: every report source a user can build from, with the
capability it requires, how it is scoped to the user's station, and the
columns it offers.

Design rules
------------
* Access is decided here, on the server. A source is offered, previewed or
  exported only if the user holds one of its capabilities (Auth.rbac.can);
  the frontend never decides what a role may see.
* Rows are scoped with Auth.scoping.people_scope: station users see their
  station, provincial users their province, national users everything.
* Every column is single-valued for its row, so a report is one SQL query
  via .values_list() - no N+1 lookups and no duplicate rows. "Latest" facts
  (current class, current rank, release dates) are correlated subqueries.
  To-many data gets its own source (e.g. one row per offence).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

from django.apps import apps
from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce

OPERATORS = {
    "text": ["equals", "not_equals", "contains", "does_not_contain", "starts_with", "ends_with", "is_empty", "is_not_empty"],
    "number": ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"],
    "date": ["equals", "before", "after", "on_or_before", "on_or_after", "between", "today", "yesterday",
             "this_week", "this_month", "this_year", "last_n_days", "next_n_days"],
    "choice": ["equals", "not_equals", "in", "not_in"],
    "boolean": ["is_true", "is_false"],
}


@dataclass(frozen=True)
class Column:
    key: str
    label: str
    group: str
    path: str                       # ORM path, or the annotation alias when `annotate` is set
    type: str = "text"              # text | number | date | choice | boolean
    choices: Optional[tuple] = None  # ((value, label), ...); read from the model field when omitted
    annotate: Optional[Callable] = None  # () -> expression, added only when the column is used


@dataclass(frozen=True)
class Source:
    key: str
    label: str
    description: str
    module: str
    model: str                      # "App.Model"
    capabilities: tuple             # any one of these grants access
    columns: tuple
    default_columns: tuple
    default_sort: tuple             # ((column key, "asc"|"desc"), ...)
    scope: Callable = field(default=lambda qs, scope: qs)

    @property
    def model_class(self):
        return apps.get_model(*self.model.split("."))

    def column(self, key):
        return next((c for c in self.columns if c.key == key), None)


# --------------------------------------------------------------------------- scoping

def _inmate_scope(prefix=""):
    """Inmates owned by a unit in scope; legacy rows with no owner fall back to station history."""
    def apply(qs, scope):
        if scope.everywhere:
            return qs
        InmateStationHistory = apps.get_model("Reception", "InmateStationHistory")
        legacy = Exists(InmateStationHistory.objects.filter(
            inmate_id=OuterRef(f"{prefix}pk" if not prefix else f"{prefix}id"),
            station_id__in=scope.station_ids,
        ))
        return qs.filter(
            Q(**{f"{prefix}owner_org_unit_id__in": scope.unit_ids})
            | (Q(**{f"{prefix}owner_org_unit__isnull": True}) & legacy)
        )
    return apply


def _station_scope(*, owner=False):
    """Health records: by station, or by owning org unit where the model has one."""
    def apply(qs, scope):
        if scope.everywhere:
            return qs
        condition = Q(station_id__in=scope.station_ids)
        if owner:
            condition |= Q(owner_org_unit_id__in=scope.unit_ids)
        return qs.filter(condition)
    return apply


def _officer_scope(qs, scope):
    from Auth.scoping import officers_in_scope
    return officers_in_scope(qs, scope)


# --------------------------------------------------------------------------- subqueries

def _latest(model, fk, value, order=("-id",), **filters):
    def build():
        Model = apps.get_model(*model.split("."))
        return Subquery(
            Model.objects.filter(**{fk: OuterRef("pk")}, **filters).order_by(*order).values(value)[:1]
        )
    return build


def _count(model, fk, **filters):
    def build():
        Model = apps.get_model(*model.split("."))
        counted = (
            Model.objects.filter(**{fk: OuterRef("pk")}, **filters)
            .order_by().values(fk).annotate(n=Count("pk")).values("n")
        )
        return Coalesce(Subquery(counted, output_field=IntegerField()), Value(0))
    return build


# --------------------------------------------------------------------------- sources

INMATES = Source(
    key="inmates",
    label="Inmates",
    description="One row per inmate: identity, home history, admission, classification and release dates.",
    module="Reception",
    model="Reception.Inmate",
    capabilities=("reception.view",),
    scope=_inmate_scope(),
    columns=(
        Column("prison_number", "Prison Number", "Identity", "prison_number"),
        Column("crb_number", "CRB Number", "Identity", "crb_number"),
        Column("surname", "Surname", "Identity", "surname"),
        Column("first_name", "First Name", "Identity", "first_name"),
        Column("other_names", "Other Names", "Identity", "other_names"),
        Column("gender", "Gender", "Identity", "gender", "choice"),
        Column("date_of_birth", "Date of Birth", "Identity", "date_of_birth", "date"),
        Column("national_id", "National ID", "Identity", "national_id"),
        Column("nationality", "Nationality", "Identity", "nationality"),
        Column("marital_status", "Marital Status", "Personal", "marital_status", "choice"),
        Column("educational_level", "Educational Level", "Personal", "educational_level"),
        Column("occupation", "Occupation", "Personal", "occupation"),
        Column("address", "Residential Address", "Personal", "address"),
        Column("fathers_name", "Father's Name", "Home History", "fathers_name"),
        Column("race", "Race", "Home History", "race"),
        Column("district", "District", "Home History", "district"),
        Column("chief", "Chief", "Home History", "chief"),
        Column("headman", "Headman", "Home History", "headman"),
        Column("admission_type", "Admission Type", "Admission", "admission_type", "choice"),
        Column("admission_date", "Admission Date", "Admission", "admission_date", "date"),
        Column("admission_status", "Admission Status", "Admission", "admission_status", "choice"),
        Column("current_status", "Custody Status", "Admission", "current_status", "choice"),
        Column("is_first_time_offender", "First-time Offender", "Admission", "is_first_time_offender", "boolean"),
        Column("station", "Station", "Admission", "owner_org_unit__name"),
        Column("current_class", "Current Class", "Classification", "current_class", "choice",
               choices=(("A", "A"), ("B", "B"), ("C", "C"), ("D", "D"), ("PUSOD", "PUSOD"), ("COND", "Condemned"), ("CONDEM", "Condemned")),
               annotate=_latest("Reception.InmateClassificationHistory", "inmate", "classification",
                                order=("-effective_date", "-id"))),
        Column("offence_count", "Number of Offences", "Offences", "offence_count", "number",
               annotate=_count("Reception.Offence", "inmate")),
        Column("remand_count", "Offences on Remand", "Offences", "remand_count", "number",
               annotate=_count("Reception.Offence", "inmate", Offence_status="UNCONVICTED")),
        Column("sentence_months", "Total Sentence (Months)", "Sentence", "sentence_months", "number",
               annotate=_latest("Reception.ReleaseHistory", "inmate", "total_effective_sentence")),
        Column("sentence_days", "Total Sentence (Days)", "Sentence", "sentence_days", "number",
               annotate=_latest("Reception.ReleaseHistory", "inmate", "total_sentences_days")),
        Column("remission_days", "Remission (Days)", "Sentence", "remission_days", "number",
               annotate=_latest("Reception.ReleaseHistory", "inmate", "total_remission_days")),
        Column("edr", "Earliest Date of Release", "Sentence", "edr", "date",
               annotate=_latest("Reception.ReleaseHistory", "inmate", "active_edr")),
        Column("odr", "Official Date of Release", "Sentence", "odr", "date",
               annotate=_latest("Reception.ReleaseHistory", "inmate", "active_odr")),
        Column("nok_name", "Next of Kin", "Next of Kin", "nok_name",
               annotate=_latest("Reception.NextOfKin", "inmate", "full_name")),
        Column("nok_relationship", "Next of Kin Relationship", "Next of Kin", "nok_relationship",
               annotate=_latest("Reception.NextOfKin", "inmate", "relationship")),
        Column("nok_contact", "Next of Kin Contact", "Next of Kin", "nok_contact",
               annotate=_latest("Reception.NextOfKin", "inmate", "contact")),
    ),
    default_columns=("prison_number", "surname", "first_name", "gender", "admission_date", "current_class", "current_status"),
    default_sort=(("prison_number", "asc"),),
)

OFFENCES = Source(
    key="offences",
    label="Offences & Sentences",
    description="One row per offence (count): court, status, sentence, remand, bail, fine and restitution.",
    module="Reception",
    model="Reception.Offence",
    capabilities=("reception.view",),
    scope=_inmate_scope("inmate__"),
    columns=(
        Column("prison_number", "Prison Number", "Inmate", "inmate__prison_number"),
        Column("surname", "Surname", "Inmate", "inmate__surname"),
        Column("first_name", "First Name", "Inmate", "inmate__first_name"),
        Column("gender", "Gender", "Inmate", "inmate__gender", "choice"),
        Column("station", "Station", "Inmate", "inmate__owner_org_unit__name"),
        Column("offence", "Offence", "Offence", "offence_description"),
        Column("court", "Court", "Offence", "court"),
        Column("status", "Status", "Offence", "Offence_status", "choice"),
        Column("date_charged", "Date Charged", "Offence", "date_charged", "date"),
        Column("sentence_date", "Sentence Date", "Sentence", "conviction__date_of_sentence", "date"),
        Column("sentence_years", "Sentence (Years)", "Sentence", "conviction__sentence_years", "number"),
        Column("sentence_months", "Sentence (Months)", "Sentence", "conviction__sentence_months", "number"),
        Column("sentence_days", "Sentence (Days)", "Sentence", "conviction__sentence_days", "number"),
        Column("effective_days", "Effective Sentence (Days)", "Sentence", "conviction__effective_sentence_days", "number"),
        Column("remission_days", "Remission (Days)", "Sentence", "conviction__remission_days", "number"),
        Column("concurrent", "Runs Concurrently", "Sentence", "conviction__sentence_group__is_concurrent", "boolean"),
        Column("has_fine", "Fine Imposed", "Sentence", "conviction__has_fine", "boolean"),
        Column("fine_amount", "Fine Amount", "Sentence", "conviction__fine_amount", "number"),
        Column("remand_start", "Remand Start", "Remand & Bail", "unconviction__remand_start_date", "date"),
        Column("remand_end", "Remand End", "Remand & Bail", "unconviction__remand_end_date", "date"),
        Column("next_court_date", "Next Court Date", "Remand & Bail", "unconviction__next_court_date", "date"),
        Column("has_bail", "Bail Granted", "Remand & Bail", "has_bail", "boolean"),
        Column("bail_amount", "Bail Amount", "Remand & Bail", "bail_amount", "number"),
        Column("restitution_amount", "Restitution Amount", "Restitution", "restitution_amount", "number",
               annotate=_latest("Reception.Restitution", "offence", "restitution_amount")),
        Column("restitution_due", "Restitution Due Date", "Restitution", "restitution_due", "date",
               annotate=_latest("Reception.Restitution", "offence", "restitution_date")),
        Column("restitution_status", "Restitution Status", "Restitution", "restitution_status", "choice",
               choices=(("pending", "Pending"), ("partial", "Partially Paid"), ("paid", "Paid"), ("waived", "Waived")),
               annotate=_latest("Reception.Restitution", "offence", "status")),
    ),
    default_columns=("prison_number", "surname", "offence", "court", "status", "sentence_date", "effective_days"),
    default_sort=(("prison_number", "asc"),),
)

OFFICERS = Source(
    key="officers",
    label="Officers",
    description="One row per officer in the HR register: identity, service dates, rank and posting.",
    module="Human Resources",
    model="HumanResources.Officer",
    capabilities=("hr.view",),
    scope=_officer_scope,
    columns=(
        Column("service_number", "Service Number", "Officer", "service_number"),
        Column("surname", "Surname", "Officer", "surname"),
        Column("first_name", "First Name", "Officer", "first_name"),
        Column("other_names", "Other Names", "Officer", "other_names"),
        Column("gender", "Gender", "Officer", "gender", "choice"),
        Column("date_of_birth", "Date of Birth", "Officer", "date_of_birth", "date"),
        Column("national_id", "National ID", "Officer", "national_id"),
        Column("current_status", "Service Status", "Service", "current_status", "choice"),
        Column("date_of_attestation", "Date of Attestation", "Service", "date_of_attestation", "date"),
        Column("date_of_retirement", "Date of Retirement", "Service", "date_of_retirement", "date"),
        Column("current_rank", "Current Rank", "Service", "current_rank",
               annotate=_latest("HumanResources.OfficerRankHistory", "officer", "rank__name",
                                order=("-effective_date", "-id"))),
        Column("current_station", "Current Station", "Posting", "current_station",
               annotate=_latest("HumanResources.OfficerStationHistory", "officer", "station__name",
                                order=("-date_posted", "-id"), date_transferred__isnull=True)),
        Column("date_posted", "Date Posted", "Posting", "date_posted", "date",
               annotate=_latest("HumanResources.OfficerStationHistory", "officer", "date_posted",
                                order=("-date_posted", "-id"), date_transferred__isnull=True)),
    ),
    default_columns=("service_number", "surname", "first_name", "current_rank", "current_station", "current_status"),
    default_sort=(("surname", "asc"),),
)

PATIENTS = Source(
    key="patients",
    label="Health - Patients",
    description="One row per registered patient (inmates, officers, dependants and others).",
    module="Health",
    model="Health.Patient",
    capabilities=("health.view",),
    scope=_station_scope(owner=True),
    columns=(
        Column("full_name", "Full Name", "Patient", "full_name"),
        Column("patient_type", "Patient Type", "Patient", "patient_type", "choice"),
        Column("gender", "Gender", "Patient", "gender", "choice"),
        Column("date_of_birth", "Date of Birth", "Patient", "date_of_birth", "date"),
        Column("phone_number", "Phone Number", "Patient", "phone_number"),
        Column("service_number", "Service Number", "Patient", "service_number"),
        Column("prison_number", "Prison Number", "Patient", "inmate__prison_number"),
        Column("station", "Station", "Location", "station__name"),
        Column("visit_count", "OPD Visits", "Activity", "visit_count", "number",
               annotate=_count("Health.OutPatientVisit", "patient")),
    ),
    default_columns=("full_name", "patient_type", "gender", "station"),
    default_sort=(("full_name", "asc"),),
)

OPD_VISITS = Source(
    key="opd_visits",
    label="Health - OPD Visits",
    description="One row per out-patient visit: vitals, diagnosis and treatment.",
    module="Health",
    model="Health.OutPatientVisit",
    capabilities=("health.view",),
    scope=_station_scope(),
    columns=(
        Column("visit_date", "Visit Date", "Visit", "visit_date", "date"),
        Column("patient", "Patient", "Patient", "patient__full_name"),
        Column("patient_type", "Patient Type", "Patient", "patient__patient_type", "choice"),
        Column("temperature", "Temperature", "Vitals", "temperature", "number"),
        Column("blood_pressure", "Blood Pressure", "Vitals", "blood_pressure"),
        Column("weight", "Weight (kg)", "Vitals", "weight", "number"),
        Column("problem", "Presenting Problem", "Clinical", "problem"),
        Column("diagnosis", "Diagnosis", "Clinical", "diagnosis"),
        Column("treatment", "Treatment", "Clinical", "treatment"),
        Column("referral", "Referral", "Clinical", "referral"),
        Column("follow_up_required", "Follow-up Required", "Clinical", "follow_up_required", "boolean"),
        Column("attended_by", "Attended By", "Staff", "attended_by"),
        Column("station", "Station", "Location", "station__name"),
    ),
    default_columns=("visit_date", "patient", "patient_type", "diagnosis", "treatment"),
    default_sort=(("visit_date", "desc"),),
)

CHRONIC = Source(
    key="chronic_patients",
    label="Health - Chronic Patients",
    description="One row per chronic-care registration and medication collection.",
    module="Health",
    model="Health.ChronicPatient",
    capabilities=("health.view",),
    scope=_station_scope(),
    columns=(
        Column("patient", "Patient", "Patient", "patient__full_name"),
        Column("patient_type", "Patient Type", "Patient", "patient__patient_type", "choice"),
        Column("registration_date", "Registration Date", "Registration", "registration_date", "date"),
        Column("registered_by", "Registered By", "Registration", "registered_by"),
        Column("medication_types", "Medication", "Medication", "medication_types"),
        Column("quantity_collected", "Quantity Collected", "Medication", "quantity_collected"),
        Column("collection_date", "Last Collection Date", "Medication", "medication_collection_date", "date"),
        Column("station", "Station", "Location", "station__name"),
    ),
    default_columns=("patient", "registration_date", "medication_types", "collection_date"),
    default_sort=(("registration_date", "desc"),),
)

MEDICINES = Source(
    key="medicines",
    label="Health - Medicine List",
    description="One row per medicine registered in the health module, with its reorder level.",
    module="Health",
    model="Health.Medicine",
    capabilities=("health.view",),
    columns=(
        Column("medicine_name", "Medicine", "Medicine", "medicine_name"),
        Column("dosage_form", "Dosage Form", "Medicine", "dosage_form"),
        Column("strength", "Strength", "Medicine", "strength"),
        Column("unit_of_measure", "Unit of Measure", "Medicine", "unit_of_measure"),
        Column("reorder_level", "Reorder Level", "Stock", "reorder_level", "number"),
    ),
    default_columns=("medicine_name", "dosage_form", "strength", "reorder_level"),
    default_sort=(("medicine_name", "asc"),),
)

SOURCES = {s.key: s for s in (INMATES, OFFENCES, OFFICERS, PATIENTS, OPD_VISITS, CHRONIC, MEDICINES)}


# --------------------------------------------------------------------------- access

def can_use(user, source: Source) -> bool:
    """Server-side gate: the user holds one of the source's capabilities."""
    from Auth.rbac import can

    if getattr(user, "is_superuser", False):
        return True
    return any(can(user, capability) for capability in source.capabilities)


def sources_for(user):
    return [s for s in SOURCES.values() if can_use(user, s)]


def column_choices(source: Source, column: Column):
    """Explicit choices, else the model field's choices (walking the ORM path)."""
    if column.choices:
        seen, out = set(), []
        for value, label in column.choices:
            if value not in seen:
                seen.add(value)
                out.append({"value": value, "label": label})
        return out
    if column.type != "choice" or column.annotate:
        return None
    model = source.model_class
    parts = column.path.split("__")
    try:
        for part in parts[:-1]:
            model = model._meta.get_field(part).related_model
        model_field = model._meta.get_field(parts[-1])
    except Exception:
        return None
    return [{"value": v, "label": str(l)} for v, l in (model_field.choices or [])] or None


def describe(source: Source):
    """Catalogue entry sent to the browser."""
    return {
        "key": source.key,
        "label": source.label,
        "description": source.description,
        "module": source.module,
        "default_columns": list(source.default_columns),
        "default_sort": [{"key": k, "direction": d} for k, d in source.default_sort],
        "columns": [
            {
                "key": c.key,
                "label": c.label,
                "group": c.group,
                "type": c.type,
                "operators": OPERATORS[c.type],
                "choices": column_choices(source, c),
            }
            for c in source.columns
        ],
    }
