# Migration for Stores app: Add org_unit ownership fields to StockReceipt and FeedingSession

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('Auth', '0003_phase_1_organizational_models'),
        ('Stores', '0001_initial'),
    ]

    operations = [
        # Add receiving_org_unit to StockReceipt
        migrations.AddField(
            model_name='stockreceipt',
            name='receiving_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='stock_receipts',
                to='Auth.orgunit',
                db_index=True,
                help_text="Organization unit that receives this stock. Used for data isolation."
            ),
        ),
        migrations.AddIndex(
            model_name='stockreceipt',
            index=models.Index(fields=['receiving_org_unit', 'received_date'], name='stockreceipt_org_date_idx'),
        ),

        # Add providing_org_unit and consuming_org_unit to FeedingSession
        migrations.AddField(
            model_name='feedingsession',
            name='providing_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='feeding_sessions_provided',
                to='Auth.orgunit',
                help_text="Organization unit providing the food/rations."
            ),
        ),
        migrations.AddField(
            model_name='feedingsession',
            name='consuming_org_unit',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='feeding_sessions_consumed',
                to='Auth.orgunit',
                help_text="Organization unit consuming the food/rations."
            ),
        ),
        migrations.AddIndex(
            model_name='feedingsession',
            index=models.Index(fields=['providing_org_unit', 'consuming_org_unit', 'feeding_date'], name='feedingsession_orgs_date_idx'),
        ),
    ]
