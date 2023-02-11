from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

from delivery import views

app_name = "delivery"

urlpatterns = [
    # Аутентификация/авторизация пользователей
    path("auth/get-token/", TokenObtainPairView.as_view(), name="get_token_pair"),
    path("auth/signup/", views.RegisterAPIView.as_view(), name="register"),
    path("auth/change-email/", views.change_my_email, name="change_email"),
    path("auth/change-password/", views.change_my_password, name="change_password"),
    path(
        "profile/",
        views.UserInfoViewSet.as_view(
            {
                "get": "get_current",
                "patch": "partial_update_current",
                "delete": "delete_current",
            }
        ),
        name="user_settings",
    ),
    path(
        "profile/transactions/",
        views.get_user_transactions,
        name="get_user_transactions",
    ),
    # Запрос для добавления средств на баланс
    path(
        "payment/top_up_the_balance/",
        views.top_up_the_balance,
        name="top_up_the_balance",
    ),
    # Обработка пополнения баланса
    path("payment/process/", views.payment_process, name="process"),
    path("payment/done/", views.payment_done, name="done"),
    path("payment/canceled/", views.payment_canceled, name="canceled"),
    # Вспомогательные запросы
    path("customers/", views.get_all_customers, name="get_all_customers"),
    path("couriers/", views.get_all_couriers, name="get_all_couriers"),
    path("orders/", views.get_all_orders, name="get_all_orders"),
    path("orders/<int:pk>/", views.get_order_detail, name="get_order_detail"),
    # Курьер
    path("courier/free-orders/", views.get_free_orders, name="get_free_orders"),
    path(
        "courier/orders/<int:pk>/",
        views.take_order_to_deliver,
        name="take_order_to_deliver",
    ),
    path(
        "courier/current-order/",
        views.CourierCurrentOrderViewSet.as_view(
            {
                "get": "get_current_order",
                "put": "finish_current_order",
                "delete": "cancel_current_order",
            }
        ),
    ),
    path(
        "courier/my-orders/history/",
        views.get_courier_order_history,
        name="get_courier_order_history",
    ),
    # Заказчик
    path(
        "customer/my-orders/",
        views.ListPostCustomerOrderViewSet.as_view(
            {
                "get": "get_sender_orders",
                "post": "post_new_sender_order",
            }
        ),
    ),
    path(
        "customer/my-orders/<int:pk>/",
        views.ReadUpdateDeleteCustomerOrderViewSet.as_view(
            {
                "get": "get_sender_order_detail",
                "patch": "update_sender_order_info",
                "delete": "delete_sender_order",
            }
        ),
    ),
    path(
        "customer/my-orders/history/",
        views.get_customer_order_history,
        name="get_customer_order_history",
    ),
]
