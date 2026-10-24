import re

with open('Reception/models.py', 'r') as f:
    content = f.read()

# Add to Convicted
convicted_fields = """
    sentence_years = models.PositiveIntegerField(default=0)
    sentence_months = models.PositiveIntegerField(default=0)
    sentence_days = models.PositiveIntegerField(default=0)

    @property
    def effective_sentence_days(self):
        return (self.sentence_years * 365) + (self.sentence_months * 30) + self.sentence_days

    @property
    def remission_days(self):
        return self.effective_sentence_days // 3
"""
content = re.sub(r'(class Convicted\(models\.Model\):.*?sentence_end_date = models\.DateField\(null=True, blank=True\))', r'\1\n' + convicted_fields, content, flags=re.DOTALL)

# Add to Restitution
restitution_fields = """
    restitution_sentence_years = models.PositiveIntegerField(default=0)
    restitution_sentence_months = models.PositiveIntegerField(default=0)
    restitution_sentence_days = models.PositiveIntegerField(default=0)

    @property
    def restitution_sentence_days_total(self):
        return (self.restitution_sentence_years * 365) + (self.restitution_sentence_months * 30) + self.restitution_sentence_days
"""
content = re.sub(r'(class Restitution\(models\.Model\):.*?receipt = models\.FileField\(upload_to=\'inmate/restitution_receipts/\', blank=True, null=True\))', r'\1\n' + restitution_fields, content, flags=re.DOTALL)

# Add to ReleaseHistory
release_history_fields = """
    total_sentences_days = models.PositiveIntegerField(default=0)
    total_remission_days = models.PositiveIntegerField(default=0)
    odr_standard = models.DateField(null=True, blank=True)
    edr_standard = models.DateField(null=True, blank=True)
    odr_restitution_paid = models.DateField(null=True, blank=True)
    edr_restitution_paid = models.DateField(null=True, blank=True)
    active_edr = models.DateField(null=True, blank=True)
    active_odr = models.DateField(null=True, blank=True)
"""
content = re.sub(r'(class ReleaseHistory\(models\.Model\):.*?earliest_date_of_release = models\.DateField\(\))', r'\1\n' + release_history_fields, content, flags=re.DOTALL)

# Append logic and signals at the bottom
logic = """
from datetime import timedelta
def calculate_inmate_release_dates(inmate):
    convictions = Convicted.objects.filter(prison_number=inmate)
    
    total_sentences_days = 0
    grouped_convictions = {}
    independent_convictions = []

    for c in convictions:
        if c.sentence_group:
            if c.sentence_group.is_concurrent:
                if c.sentence_group.id not in grouped_convictions:
                    grouped_convictions[c.sentence_group.id] = []
                grouped_convictions[c.sentence_group.id].append(c)
            else:
                independent_convictions.append(c)
        else:
            independent_convictions.append(c)

    date_of_sentence = None
    
    for sg_id, group in grouped_convictions.items():
        if group:
            max_days = max(c.effective_sentence_days for c in group)
            total_sentences_days += max_days
            for c in group:
                if c.date_of_sentence and (date_of_sentence is None or c.date_of_sentence < date_of_sentence):
                    date_of_sentence = c.date_of_sentence

    for c in independent_convictions:
        total_sentences_days += c.effective_sentence_days
        if c.date_of_sentence and (date_of_sentence is None or c.date_of_sentence < date_of_sentence):
            date_of_sentence = c.date_of_sentence

    if not date_of_sentence:
        date_of_sentence = inmate.admission_date

    total_remission_days = total_sentences_days // 3

    odr_standard = date_of_sentence + timedelta(days=total_sentences_days)
    edr_standard = odr_standard - timedelta(days=total_remission_days)

    offences = [c.offence for c in convictions]
    restitutions = Restitution.objects.filter(offence__in=offences)
    
    total_restitution_days = sum(r.restitution_sentence_days_total for r in restitutions)

    if total_restitution_days > 0:
        net_sentences_days = total_sentences_days - total_restitution_days
        if net_sentences_days < 0:
            net_sentences_days = 0
        net_remission_days = net_sentences_days // 3
        odr_restitution_paid = date_of_sentence + timedelta(days=net_sentences_days)
        edr_restitution_paid = odr_restitution_paid - timedelta(days=net_remission_days)
    else:
        odr_restitution_paid = None
        edr_restitution_paid = None
        net_sentences_days = 0
        net_remission_days = 0

    restitution_valid = False
    if restitutions.exists():
        restitution_valid = True
        for r in restitutions:
            if r.status != 'paid' or not r.receipt or timezone.now().date() <= r.restitution_date:
                restitution_valid = False
                break
    
    if restitution_valid:
        active_edr = edr_restitution_paid
        active_odr = odr_restitution_paid
        active_total_days = net_sentences_days
        active_remission_days = net_remission_days
    else:
        active_edr = edr_standard
        active_odr = odr_standard
        active_total_days = total_sentences_days
        active_remission_days = total_remission_days

    rh, created = ReleaseHistory.objects.get_or_create(inmate=inmate, defaults={'earliest_date_of_release': active_edr or timezone.now().date()})
    rh.total_sentences_days = active_total_days
    rh.total_remission_days = active_remission_days
    rh.odr_standard = odr_standard
    rh.edr_standard = edr_standard
    rh.odr_restitution_paid = odr_restitution_paid
    rh.edr_restitution_paid = edr_restitution_paid
    rh.active_edr = active_edr
    rh.active_odr = active_odr
    rh.earliest_date_of_release = active_edr or timezone.now().date()
    rh.total_effective_sentence = active_total_days // 30
    rh.remission = active_remission_days / 30.0
    rh.save()

@receiver(post_save, sender=Convicted)
def update_release_dates_on_conviction_save(sender, instance, **kwargs):
    calculate_inmate_release_dates(instance.prison_number)

@receiver(post_delete, sender=Convicted)
def update_release_dates_on_conviction_delete(sender, instance, **kwargs):
    calculate_inmate_release_dates(instance.prison_number)

@receiver(post_save, sender=Restitution)
def update_release_dates_on_restitution_save(sender, instance, **kwargs):
    if instance.offence and hasattr(instance.offence, 'conviction'):
        calculate_inmate_release_dates(instance.offence.conviction.prison_number)

@receiver(post_delete, sender=Restitution)
def update_release_dates_on_restitution_delete(sender, instance, **kwargs):
    if instance.offence and hasattr(instance.offence, 'conviction'):
        calculate_inmate_release_dates(instance.offence.conviction.prison_number)
"""

content += "\n" + logic

with open('Reception/models.py', 'w') as f:
    f.write(content)

