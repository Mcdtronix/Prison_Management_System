# Migration for HumanResources app: Add posting_org_unit to OfficerStationHistory

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0003_phase_1_organizational_models'),
        ('HumanResources', '0001_initial'),
    ]

    operations = [
        # Add posting_org_unit to OfficerStationHistory
        migrations.AddField(
            model_name='officerstationhistory',
            name='posting_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='officer_postings',
                to='Auth.orgunit',
                db_index=True,
                help_text="Organization unit where officer is posted (replaces Station FK)."
            ),
        ),
        migrations.AddIndex(
            model_name='officerstationhistory',
            index=models.Index(fields=['posting_org_unit', 'date_posted'], name='officerstationhistory_org_date_idx'),
        ),
    ]
