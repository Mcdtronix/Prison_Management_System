from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Reception", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="inmate",
            name="address",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="educational_level",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="race",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="headman",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="chief",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="district",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="occupation",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="is_first_time_offender",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="inmate",
            name="inmate_image",
            field=models.ImageField(blank=True, null=True, upload_to="inmate/photos/"),
        ),
    ]
