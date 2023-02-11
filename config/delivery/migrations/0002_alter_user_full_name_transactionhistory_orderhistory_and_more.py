# Generated by Django 4.1.4 on 2022-12-25 17:43

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('delivery', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='full_name',
            field=models.CharField(blank=True, max_length=300, verbose_name='full name'),
        ),
        migrations.CreateModel(
            name='TransactionHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('time_happened', models.DateTimeField(auto_now_add=True)),
                ('description', models.TextField()),
                ('cost', models.DecimalField(decimal_places=2, max_digits=7)),
                ('braintree_id', models.CharField(max_length=150)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='OrderHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=300)),
                ('price', models.DecimalField(decimal_places=2, max_digits=7)),
                ('detail', models.TextField()),
                ('weight', models.PositiveIntegerField()),
                ('address_from', models.CharField(max_length=300)),
                ('address_to', models.CharField(max_length=300)),
                ('time_to_pickup', models.DateTimeField()),
                ('time_to_deliver', models.DateTimeField()),
                ('courier_payment', models.DecimalField(decimal_places=2, max_digits=7)),
                ('recipient', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recipient_processed_order', to=settings.AUTH_USER_MODEL)),
                ('sender', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sender_processed_order', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Order',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=300)),
                ('price', models.DecimalField(decimal_places=2, max_digits=7)),
                ('detail', models.TextField()),
                ('weight', models.PositiveIntegerField()),
                ('address_from', models.CharField(max_length=300)),
                ('address_to', models.CharField(max_length=300)),
                ('time_to_pickup', models.DateTimeField()),
                ('time_to_deliver', models.DateTimeField()),
                ('courier_payment', models.DecimalField(decimal_places=2, max_digits=7)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recipient_orders', to=settings.AUTH_USER_MODEL)),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sender_orders', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='CourierAdditionalData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('current_order', models.OneToOneField(null=True, on_delete=django.db.models.deletion.SET_NULL, to='delivery.order')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]