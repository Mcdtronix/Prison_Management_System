import re

with open('Reception/models.py', 'r') as f:
    content = f.read()

# Replace Convicted properties with fields and save
content = re.sub(
    r'@property\n    def effective_sentence_days\(self\):\n        return \(self\.sentence_years \* 365\) \+ \(self\.sentence_months \* 30\) \+ self\.sentence_days\n\n    @property\n    def remission_days\(self\):\n        return self\.effective_sentence_days // 3',
    r'effective_sentence_days = models.PositiveIntegerField(default=0)\n    remission_days = models.PositiveIntegerField(default=0)\n\n    def save(self, *args, **kwargs):\n        self.effective_sentence_days = (self.sentence_years * 365) + (self.sentence_months * 30) + self.sentence_days\n        self.remission_days = self.effective_sentence_days // 3\n        super().save(*args, **kwargs)',
    content
)

# Replace Restitution properties with fields and save
content = re.sub(
    r'@property\n    def restitution_sentence_days_total\(self\):\n        return \(self\.restitution_sentence_years \* 365\) \+ \(self\.restitution_sentence_months \* 30\) \+ self\.restitution_sentence_days',
    r'restitution_sentence_days_total = models.PositiveIntegerField(default=0)\n\n    def save(self, *args, **kwargs):\n        self.restitution_sentence_days_total = (self.restitution_sentence_years * 365) + (self.restitution_sentence_months * 30) + self.restitution_sentence_days\n        if not self.restitution_date and self.offence:\n            self.restitution_date = self.offence.date_charged\n        super().save(*args, **kwargs)',
    content
)

with open('Reception/models.py', 'w') as f:
    f.write(content)

