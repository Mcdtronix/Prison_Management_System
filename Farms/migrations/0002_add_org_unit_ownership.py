# Migration for Farms app: Add owner_org_unit to FarmProject

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0003_phase_1_organizational_models'),
        ('Farms', '0001_initial'),
    ]

    operations = [
        # Add owner_org_unit to FarmProject
        migrations.AddField(
            model_name='farmproject',
            name='owner_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='farm_projects',
                to='Auth.orgunit',
                db_index=True,
                help_text="Organization unit that owns this farm project."
            ),
        ),
        migrations.AddIndex(
            model_name='farmproject',
            index=models.Index(fields=['owner_org_unit', 'status'], name='farmproject_owner_status_idx'),
        ),
    ]
