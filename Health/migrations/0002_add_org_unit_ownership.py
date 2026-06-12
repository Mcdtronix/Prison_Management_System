# Migration for Health app: Add owner_org_unit to Patient and AdmissionHealthAssessment

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0003_phase_1_organizational_models'),
        ('Health', '0001_initial'),
    ]

    operations = [
        # Add owner_org_unit to Patient
        migrations.AddField(
            model_name='patient',
            name='owner_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='patients',
                to='Auth.orgunit',
                db_index=True,
                help_text="Organization unit that owns this patient record. Used for data isolation."
            ),
        ),
        migrations.AddIndex(
            model_name='patient',
            index=models.Index(fields=['owner_org_unit', 'patient_type'], name='patient_owner_org_type_idx'),
        ),

        # Add owner_org_unit to AdmissionHealthAssessment
        migrations.AddField(
            model_name='admissionhealthassessment',
            name='owner_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='admission_assessments',
                to='Auth.orgunit',
                db_index=True,
                help_text="Organization unit where this assessment was conducted."
            ),
        ),
        migrations.AddIndex(
            model_name='admissionhealthassessment',
            index=models.Index(fields=['owner_org_unit', 'assessment_date'], name='admission_assessment_org_date_idx'),
        ),
    ]
