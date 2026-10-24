import re

with open("Reception/serializers.py", "r") as f:
    content = f.read()

# Let's find InmateListSerializer and everything after it
match = re.search(r"class InmateListSerializer\(serializers\.ModelSerializer\):.*?(?=class |$)", content, re.DOTALL)
if match:
    # We will replace the entire InmateListSerializer with the correct one
    new_serializer = """class InmateListSerializer(serializers.ModelSerializer):
    \"\"\"Serializer for listing inmates with key summary data.\"\"\"
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
        \"\"\"Return a comma-separated list of offence descriptions.\"\"\"
        return ", ".join([offence.offence_description for offence in obj.offences.all()])

    def get_status(self, obj):
        \"\"\"Determine the inmate's overall status based on their admission status and current status.\"\"\"
        if obj.current_status == "DISCHARGED":
            return "discharged"
        if obj.current_status == "TRANSFERRED":
            return "transferred"
            
        if obj.admission_status in ["PENDING_HEALTH_ASSESSMENT", "PENDING_ADMIN_APPROVAL"]:
            return "pending"
            
        return "active"

    def get_classification(self, obj):
        \"\"\"Get the inmate's most recent classification.\"\"\"
        latest_classification = obj.classification_history.order_by('-effective_date').first()
        return latest_classification.classification if latest_classification else 'N/A'
"""
    new_content = content[:match.start()] + new_serializer + content[match.end():]
    with open("Reception/serializers.py", "w") as f:
        f.write(new_content)
    print("Fixed InmateListSerializer")
else:
    print("Could not find InmateListSerializer")

