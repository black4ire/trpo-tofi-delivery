from django.contrib import admin

from delivery.models import (
    CourierAdditionalData,
    Order,
    OrderHistory,
    TransactionHistory,
    User,
)

admin.site.register(User)
admin.site.register(CourierAdditionalData)
admin.site.register(Order)
admin.site.register(OrderHistory)
admin.site.register(TransactionHistory)
