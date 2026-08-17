OPERATORS = {
    'text': ['equals', 'not_equals', 'contains', 'does_not_contain', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
    'number': ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between'],
    'date': ['equals', 'before', 'after', 'on_or_before', 'on_or_after', 'between', 'today', 'yesterday', 'this_week', 'this_month', 'this_year', 'last_n_days', 'next_n_days'],
    'choice': ['equals', 'not_equals', 'in', 'not_in'],
    'boolean': ['is_true', 'is_false']
}

def get_field_registry(model_name):
    if model_name == 'Inmate':
        return get_inmate_registry()
    elif model_name == 'Officer':
        return get_officer_registry()
    elif model_name == 'Patient':
        return get_health_patient_registry()
    elif model_name == 'OutPatientVisit':
        return get_health_opd_registry()
    elif model_name == 'ChronicPatient':
        return get_health_chronic_registry()
    elif model_name == 'Medicine':
        return get_health_medicine_registry()
    return []

def get_inmate_registry():
    return [
        # INMATE DEMOGRAPHICS
        {"key": "prison_number", "label": "Prison Number", "field": "prison_number", "group": "INMATE", "type": "text", "operators": OPERATORS['text']},
        {"key": "first_name", "label": "First Name", "field": "first_name", "group": "INMATE", "type": "text", "operators": OPERATORS['text']},
        {"key": "surname", "label": "Surname", "field": "surname", "group": "INMATE", "type": "text", "operators": OPERATORS['text']},
        {"key": "national_id", "label": "National ID", "field": "national_id", "group": "INMATE", "type": "text", "operators": OPERATORS['text']},
        {"key": "date_of_birth", "label": "Date of Birth", "field": "date_of_birth", "group": "INMATE", "type": "date", "operators": OPERATORS['date']},
        {"key": "gender", "label": "Gender", "field": "gender", "group": "INMATE", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "Male", "label": "Male"}, {"value": "Female", "label": "Female"}]},
        {"key": "marital_status", "label": "Marital Status", "field": "marital_status", "group": "INMATE", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "Single", "label": "Single"}, {"value": "Married", "label": "Married"}, {"value": "Divorced", "label": "Divorced"}, {"value": "Widowed", "label": "Widowed"}]},
        {"key": "nationality", "label": "Nationality", "field": "nationality", "group": "INMATE", "type": "text", "operators": OPERATORS['text']},
        
        # ADMISSION
        {"key": "admission_type", "label": "Admission Type", "field": "admission_type", "group": "ADMISSION", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "NEW_ADMISSION", "label": "New Admission"}, {"value": "TRANSFER", "label": "Transfer"}]},
        {"key": "admission_date", "label": "Admission Date", "field": "admission_date", "group": "ADMISSION", "type": "date", "operators": OPERATORS['date']},
        {"key": "current_status", "label": "Current Status", "field": "current_status", "group": "ADMISSION", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "IN_CUSTODY", "label": "In Custody"}, {"value": "TRANSFERRED", "label": "Transferred"}, {"value": "ESCAPED", "label": "Escaped"}, {"value": "DISCHARGED", "label": "Discharged"}, {"value": "DECEASED", "label": "Deceased"}]},
        {"key": "classification", "label": "Prison Class", "field": "classification_history__classification", "group": "ADMISSION", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "A", "label": "Class A"}, {"value": "B", "label": "Class B"}, {"value": "C", "label": "Class C"}, {"value": "D", "label": "Class D"}, {"value": "COND", "label": "Condemned"}]},

        # OFFENCE
        {"key": "offence_description", "label": "Offence Description", "field": "offences__offence_description", "group": "OFFENCE", "type": "text", "operators": OPERATORS['text']},
        {"key": "conviction_status", "label": "Conviction Status", "field": "offences__Offence_status", "group": "OFFENCE", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "UNCONVICTED", "label": "Unconvicted"}, {"value": "CONVICTED", "label": "Convicted"}, {"value": "DISCHARGED", "label": "Discharged"}]},
        {"key": "date_charged", "label": "Date Charged", "field": "offences__date_charged", "group": "OFFENCE", "type": "date", "operators": OPERATORS['date']},
        
        # COURT
        {"key": "court_name", "label": "Court Name", "field": "offences__court", "group": "COURT", "type": "text", "operators": OPERATORS['text']},

        # SENTENCE
        {"key": "sentence_years", "label": "Sentence (Years)", "field": "convictions__sentence_years", "group": "SENTENCE", "type": "number", "operators": OPERATORS['number']},
        {"key": "sentence_months", "label": "Sentence (Months)", "field": "convictions__sentence_months", "group": "SENTENCE", "type": "number", "operators": OPERATORS['number']},
        {"key": "effective_sentence_days", "label": "Sentence (Effective Days)", "field": "convictions__effective_sentence_days", "group": "SENTENCE", "type": "number", "operators": OPERATORS['number']},
        {"key": "expected_release_date", "label": "Expected Release Date", "field": "release_history__earliest_date_of_release", "group": "SENTENCE", "type": "date", "operators": OPERATORS['date']},

        # NEXT OF KIN
        {"key": "nok_name", "label": "Next of Kin Name", "field": "next_of_kin__full_name", "group": "NEXT OF KIN", "type": "text", "operators": OPERATORS['text']},
        {"key": "nok_relationship", "label": "NOK Relationship", "field": "next_of_kin__relationship", "group": "NEXT OF KIN", "type": "text", "operators": OPERATORS['text']},

        # LOCATION / STATION
        {"key": "current_station_name", "label": "Current Station", "field": "station_history__station__name", "group": "LOCATION", "type": "text", "operators": OPERATORS['text']},
    ]

def get_officer_registry():
    return [
        {"key": "service_number", "label": "Service Number", "field": "service_number", "group": "OFFICER", "type": "text", "operators": OPERATORS['text']},
        {"key": "first_name", "label": "First Name", "field": "first_name", "group": "OFFICER", "type": "text", "operators": OPERATORS['text']},
        {"key": "surname", "label": "Surname", "field": "surname", "group": "OFFICER", "type": "text", "operators": OPERATORS['text']},
        {"key": "current_status", "label": "Current Status", "field": "current_status", "group": "OFFICER", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "ACTIVE", "label": "Active"}, {"value": "ON_LEAVE", "label": "On Leave"}, {"value": "SUSPENDED", "label": "Suspended"}, {"value": "DISMISSED", "label": "Dismissed"}, {"value": "RETIRED", "label": "Retired"}, {"value": "DECEASED", "label": "Deceased"}]},
        {"key": "current_station", "label": "Current Station", "field": "current_station__name", "group": "LOCATION", "type": "text", "operators": OPERATORS['text']},
        {"key": "current_rank", "label": "Current Rank", "field": "rank_history__rank__name", "group": "OFFICER", "type": "text", "operators": OPERATORS['text']},
    ]

def get_health_patient_registry():
    return [
        {"key": "patient_type", "label": "Patient Type", "field": "patient_type", "group": "PATIENT", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "INMATE", "label": "Inmate"}, {"value": "OFFICER", "label": "Officer"}, {"value": "DEPENDENT", "label": "Dependent"}, {"value": "COMMUNITY_MEMBER", "label": "Community Member"}, {"value": "EX_SERVICE_MEMBER", "label": "Ex-Service Member"}]},
        {"key": "identifier", "label": "Identifier/Name", "field": "full_name", "group": "PATIENT", "type": "text", "operators": OPERATORS['text']},
        {"key": "gender", "label": "Gender", "field": "gender", "group": "PATIENT", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "Male", "label": "Male"}, {"value": "Female", "label": "Female"}]},
        {"key": "phone_number", "label": "Phone Number", "field": "phone_number", "group": "PATIENT", "type": "text", "operators": OPERATORS['text']},
        {"key": "station", "label": "Station", "field": "station__name", "group": "LOCATION", "type": "text", "operators": OPERATORS['text']},
    ]

def get_health_opd_registry():
    return [
        {"key": "visit_date", "label": "Visit Date", "field": "visit_date", "group": "VISIT", "type": "date", "operators": OPERATORS['date']},
        {"key": "patient_type", "label": "Patient Type", "field": "patient__patient_type", "group": "PATIENT", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "INMATE", "label": "Inmate"}, {"value": "OFFICER", "label": "Officer"}, {"value": "DEPENDENT", "label": "Dependent"}, {"value": "COMMUNITY_MEMBER", "label": "Community Member"}, {"value": "EX_SERVICE_MEMBER", "label": "Ex-Service Member"}]},
        {"key": "temperature", "label": "Temperature", "field": "temperature", "group": "VITALS", "type": "number", "operators": OPERATORS['number']},
        {"key": "blood_pressure", "label": "Blood Pressure", "field": "blood_pressure", "group": "VITALS", "type": "text", "operators": OPERATORS['text']},
        {"key": "weight", "label": "Weight (kg)", "field": "weight", "group": "VITALS", "type": "number", "operators": OPERATORS['number']},
        {"key": "problem", "label": "Problem", "field": "problem", "group": "CLINICAL", "type": "text", "operators": OPERATORS['text']},
        {"key": "diagnosis", "label": "Diagnosis", "field": "diagnosis", "group": "CLINICAL", "type": "text", "operators": OPERATORS['text']},
        {"key": "treatment", "label": "Treatment", "field": "treatment", "group": "CLINICAL", "type": "text", "operators": OPERATORS['text']},
        {"key": "attended_by", "label": "Attended By", "field": "attended_by", "group": "STAFF", "type": "text", "operators": OPERATORS['text']},
        {"key": "follow_up_required", "label": "Follow Up Required", "field": "follow_up_required", "group": "CLINICAL", "type": "boolean", "operators": OPERATORS['boolean']},
    ]

def get_health_chronic_registry():
    return [
        {"key": "registration_date", "label": "Registration Date", "field": "registration_date", "group": "REGISTRATION", "type": "date", "operators": OPERATORS['date']},
        {"key": "patient_type", "label": "Patient Type", "field": "patient__patient_type", "group": "PATIENT", "type": "choice", "operators": OPERATORS['choice'], "choices": [{"value": "INMATE", "label": "Inmate"}, {"value": "OFFICER", "label": "Officer"}, {"value": "DEPENDENT", "label": "Dependent"}, {"value": "COMMUNITY_MEMBER", "label": "Community Member"}, {"value": "EX_SERVICE_MEMBER", "label": "Ex-Service Member"}]},
        {"key": "medication_types", "label": "Medication Types", "field": "medication_types", "group": "MEDICATION", "type": "text", "operators": OPERATORS['text']},
        {"key": "quantity_collected", "label": "Quantity Collected", "field": "quantity_collected", "group": "MEDICATION", "type": "text", "operators": OPERATORS['text']},
        {"key": "medication_collection_date", "label": "Last Collection Date", "field": "medication_collection_date", "group": "MEDICATION", "type": "date", "operators": OPERATORS['date']},
        {"key": "registered_by", "label": "Registered By", "field": "registered_by", "group": "STAFF", "type": "text", "operators": OPERATORS['text']},
        {"key": "station", "label": "Station", "field": "station__name", "group": "LOCATION", "type": "text", "operators": OPERATORS['text']},
    ]

def get_health_medicine_registry():
    return [
        {"key": "medicine_name", "label": "Medicine Name", "field": "medicine_name", "group": "INVENTORY", "type": "text", "operators": OPERATORS['text']},
        {"key": "dosage_form", "label": "Dosage Form", "field": "dosage_form", "group": "INVENTORY", "type": "text", "operators": OPERATORS['text']},
        {"key": "strength", "label": "Strength", "field": "strength", "group": "INVENTORY", "type": "text", "operators": OPERATORS['text']},
        {"key": "unit_of_measure", "label": "Unit of Measure", "field": "unit_of_measure", "group": "INVENTORY", "type": "text", "operators": OPERATORS['text']},
        {"key": "reorder_level", "label": "Reorder Level", "field": "reorder_level", "group": "INVENTORY", "type": "number", "operators": OPERATORS['number']},
    ]
