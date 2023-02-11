import braintree
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404, render, reverse
from rest_framework import viewsets
from rest_framework.decorators import (
    action,
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from delivery.models import (
    CourierAdditionalData,
    Order,
    OrderHistory,
    TransactionHistory,
)
from delivery.permissions import IsCourier, IsCustomer
from delivery.serializers import (
    ChangePasswordSerializer,
    GetCourierOrderHistorySerializer,
    GetCustomerOrderHistorySerializer,
    GetOrderDetailSerializer,
    GetOrderListSerializer,
    GetTransactionHistorySerializer,
    PartialUpdateOrderSerializer,
    PostOrderSerializer,
    RegisterUserSerializer,
    UpdateEmailSerializer,
    UserInfoSerializer,
    UserTopUpBalanceSerializer,
)

User = get_user_model()
gateway = braintree.BraintreeGateway(settings.BRAINTREE_CONF)

#
#
# Аутентификация/авторизация пользователя
#
#


class RegisterAPIView(CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        user = serializer.instance
        access_token = str(AccessToken.for_user(user))
        refresh_token = str(RefreshToken.for_user(user))

        response_data = serializer.data
        response_data["isCourier"] = user.is_courier
        return Response(
            {**response_data, "access": access_token, "refresh": refresh_token},
            status=201,
            headers=headers,
        )


@api_view(["PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def change_my_email(request):
    new_email = request.data.get("email")
    serializer = UpdateEmailSerializer(request.user, {"email": new_email}, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({"email": new_email}, 200)
    return Response(
        {"detail": serializer.errors.get("email", "Bad request!")},
        400,
    )


@api_view(["PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def change_my_password(request):
    serializer = ChangePasswordSerializer(
        request.user,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"message": "Successfully changed password."}, 200)


class UserInfoViewSet(viewsets.GenericViewSet):
    queryset = User.objects.all()
    serializer_class = UserInfoSerializer
    permission_classes = (IsAuthenticated,)

    @action(detail=False, methods=["get"])
    def get_current(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["patch"])
    def partial_update_current(self, request):
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, 200)

    @action(detail=False, methods=["delete"])
    def delete_current(self, request):
        request.user.delete()
        return Response({"success": "User successfully deleted."}, 204)


#
#
# Баланс пользователя
#
#


@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def top_up_the_balance(request):
    if request.method == "POST":
        serializer = UserTopUpBalanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        total_cost = serializer.validated_data.get("sum_to_add")
        # получить одноразовый номер
        nonce = request.data.get("payment_method_nonce", None)
        # создать и отправить транзакцию
        result = gateway.transaction.sale(
            {
                "amount": f"{total_cost:.2f}",
                "payment_method_nonce": nonce,
                "options": {"submit_for_settlement": True},
            }
        )
        if result.is_success:
            # отметить заказ как оплаченный
            request.user.balance += total_cost
            request.user.save()
            # сохранить уникальный идентификатор транзакции
            TransactionHistory.objects.create(
                braintree_id=result.transaction.id,
                user=request.user,
                description=f"Добавлено {total_cost} BYN на баланс {request.user.email}.",
                cost=total_cost,
            )
            return Response({"success": reverse("delivery:done")}, 200)
        else:
            return Response({"success": reverse("delivery:canceled")}, 200)
    else:
        serializer = UserTopUpBalanceSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        total_cost = serializer.validated_data.get("sum_to_add")
        # сгенерировать токен для braintree
        client_token = gateway.client_token.generate()
        access_token = request.META.get("HTTP_AUTHORIZATION").split()[1]
        return Response(
            {
                "success": reverse("delivery:process")
                + f"?total_cost={total_cost}&client_token={client_token}&access={access_token}"
            },
            200,
        )


def payment_process(request, **kwargs):
    return render(request, "process.html", kwargs)


def payment_done(request):
    return render(request, "done.html")


def payment_canceled(request):
    return render(request, "canceled.html")


#
#
# Вспомогательные запросы
#
#


@api_view(["GET"])
def get_all_customers(request):
    queryset = User.objects.filter(is_courier=False)
    response_data = UserInfoSerializer(queryset, many=True).data
    return Response(response_data, 200)


@api_view(["GET"])
def get_all_couriers(request):
    queryset = User.objects.filter(is_courier=True)
    response_data = UserInfoSerializer(queryset, many=True).data
    return Response(response_data, 200)


@api_view(["GET"])
def get_all_orders(request):
    queryset = Order.objects.all()
    response_data = GetOrderListSerializer(queryset, many=True).data
    return Response(response_data, 200)


@api_view(["GET"])
def get_order_detail(request, pk):
    queryset = get_object_or_404(Order, pk=pk)
    response_data = GetOrderDetailSerializer(queryset).data
    return Response(response_data, 200)


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_user_transactions(request):
    queryset = TransactionHistory.objects.filter(user=request.user)
    response_data = GetTransactionHistorySerializer(queryset, many=True).data
    return Response(response_data, 200)


#
#
# Курьер
#
#


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsCourier])
def get_free_orders(request):
    # Выбираем все id заказов, у которых есть курьер
    order_ids_needed = CourierAdditionalData.objects.filter(
        current_order__isnull=False
    ).values_list("current_order__id", flat=True)
    # Исключаем эти id из общего числа заказов
    queryset = Order.objects.exclude(pk__in=set(order_ids_needed))
    response_data = GetOrderListSerializer(queryset, many=True).data
    if response_data is None:
        return Response({"errors": ["Bad request."]}, 400)
    for i in range(len(response_data)):
        response_data[i]["can_pickup"] = bool(
            request.user.user_courier_data.current_order is None
        )
    return Response(response_data, 200)


@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsCourier])
def take_order_to_deliver(request, pk):
    order = get_object_or_404(Order, pk=pk)
    if CourierAdditionalData.objects.filter(current_order=order).exists():
        raise ValidationError("Order is not free.")
    if request.user.user_courier_data.current_order is not None:
        raise ValidationError(
            f"You already have the order id={request.user.user_courier_data.current_order.id}"
            + ", finish it first!"
        )
    request.user.user_courier_data.current_order = order
    request.user.user_courier_data.save()
    return Response({"success": f"You have taken the order id={order.pk}"})


class CourierCurrentOrderViewSet(viewsets.GenericViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCourier]

    @action(methods=["get"], detail=False)
    def get_current_order(self, request):
        if request.user.user_courier_data.current_order is None:
            raise ValidationError("No currently assigned order found.")
        serializer = GetOrderDetailSerializer(
            request.user.user_courier_data.current_order
        )
        return Response(serializer.data, 200)

    @action(methods=["put"], detail=False)
    def finish_current_order(self, request):
        if request.user.user_courier_data.current_order is None:
            raise ValidationError("No currently assigned order found.")
        current_order = request.user.user_courier_data.current_order
        if (
            current_order.sender.balance
            - current_order.price
            - current_order.courier_payment
            < 0
        ):
            raise ValidationError(
                "Cannot finish delivery due to sender's insufficient funds."
            )
        current_order.order_courier_data.user.balance += current_order.courier_payment
        current_order.order_courier_data.user.save()
        # Транзакция для курьера. Начисление оплаты за заказ
        TransactionHistory.objects.create(
            braintree_id="null",
            user=current_order.order_courier_data.user,
            description=(
                f"На баланс {current_order.order_courier_data.user.email} начислено "
                + f"{current_order.courier_payment} BYN за успешную доставку "
                + f"'{current_order.name}' получателю {current_order.recipient.email}."
            ),
            cost=current_order.courier_payment,
        )

        current_order.sender.balance -= (
            current_order.price + current_order.courier_payment
        )
        current_order.sender.save()
        # Транзакция для заказчика. Оплата цены заказа
        TransactionHistory.objects.create(
            braintree_id="null",
            user=current_order.sender,
            description=(
                f"С баланса {current_order.sender.email} списано {current_order.price}"
                + f" BYN за доставку '{current_order.name}'."
            ),
            cost=-current_order.price,
        )
        # Транзакция для заказчика. Оплата курьера
        TransactionHistory.objects.create(
            braintree_id="null",
            user=current_order.sender,
            description=(
                f"С баланса {current_order.sender.email} списано {current_order.courier_payment}"
                + f" BYN за оплату курьера заказа '{current_order.name}'."
            ),
            cost=-current_order.courier_payment,
        )
        # Запись заказа в историю заказов
        OrderHistory.objects.create(
            name=current_order.name,
            price=current_order.price,
            detail=current_order.detail,
            weight=current_order.weight,
            address_from=current_order.address_from,
            address_to=current_order.address_to,
            sender=current_order.sender,
            recipient=current_order.recipient,
            courier=request.user.user_courier_data.user,
            time_to_pickup=current_order.time_to_pickup,
            time_to_deliver=current_order.time_to_deliver,
            courier_payment=current_order.courier_payment,
        )

        request.user.user_courier_data.current_order = None
        request.user.user_courier_data.save()
        order_id = current_order.id
        current_order.delete()
        return Response({"success": f"Order id={order_id} came to the receiver!"}, 200)

    @action(methods=["delete"], detail=False)
    def cancel_current_order(self, request):
        if request.user.user_courier_data.current_order is None:
            raise ValidationError("No currently assigned order found.")
        current_order_id = request.user.user_courier_data.current_order.pk
        request.user.user_courier_data.current_order = None
        request.user.user_courier_data.save()
        return Response({"success": f"Canceled order id={current_order_id}"}, 200)


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsCourier])
def get_courier_order_history(request):
    queryset = OrderHistory.objects.filter(courier=request.user).order_by("-id")
    response_data = GetCourierOrderHistorySerializer(queryset, many=True).data
    return Response(response_data, 200)


#
#
# Заказчик
#
#


class ListPostCustomerOrderViewSet(viewsets.GenericViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCustomer]

    @action(methods=["get"], detail=False)
    def get_sender_orders(self, request):
        queryset = Order.objects.filter(sender=request.user)
        response_data = GetOrderListSerializer(queryset, many=True).data
        for i in range(len(response_data)):
            response_data[i]["can_edit"] = bool(
                not CourierAdditionalData.objects.filter(
                    current_order__pk=response_data[i]["id"]
                ).exists()
            )
        return Response(response_data, 200)

    @action(methods=["post"], detail=False)
    def post_new_sender_order(self, request):
        serializer = PostOrderSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        # Проверяем, достаточно ли останется у заказчика
        # денег для оплаты нового заказа
        price = serializer.validated_data["price"]
        courier_payment = serializer.validated_data["courier_payment"]
        # Общая цена нового заказа
        total_order_price = price + courier_payment
        # Выбираем все заказы текущего заказчика, среди них нас интересуют
        # только их цены и оплаты курьеру. Получаем список вида:
        # [(price, courier_payment), (price, courier_payment),(price, courier_payment), ...]
        order_prices = Order.objects.filter(sender=request.user).values_list(
            "price", "courier_payment"
        )
        # Теперь суммируем всё и получаем общую сумму на оплату этих заказов
        total_sender_price = sum([pr + cp for pr, cp in order_prices])
        # Логично, что если к сумме выше прибавить сумму нового заказа,
        # и это окажется больше текущего баланса -- у заказчика не хватит денег
        if request.user.balance < total_order_price + total_sender_price:
            raise ValidationError(
                "Insufficient funds, sender wouldn't be able to pay this order as well."
            )
        # Если денег хватает, создаём заказ
        instance = serializer.create(serializer.validated_data)
        response_data = GetOrderDetailSerializer(instance).data
        return Response(response_data, 201)


class ReadUpdateDeleteCustomerOrderViewSet(viewsets.GenericViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsCustomer]

    @action(methods=["get"], detail=True)
    def get_sender_order_detail(self, request, pk=None):
        if not Order.objects.filter(pk=pk, sender=request.user).exists():
            raise ValidationError("No such order belonging to you.")
        order = Order.objects.get(pk=pk, sender=request.user)
        serializer = GetOrderDetailSerializer(order)
        return Response(serializer.data, 200)

    @action(methods=["patch"], detail=True)
    def update_sender_order_info(self, request, pk=None):
        if not Order.objects.filter(pk=pk, sender=request.user).exists():
            raise ValidationError("No such order belonging to you.")
        order = Order.objects.get(pk=pk, sender=request.user)
        if CourierAdditionalData.objects.filter(current_order=order).exists():
            raise ValidationError(
                "This order was already taken by some courier, so you can't update it."
            )
        serializer = PartialUpdateOrderSerializer(
            order, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        # Проверяем, достаточно ли останется у заказчика
        # денег для оплаты заказа с обновлёнными данными
        price = serializer.validated_data.get("price", None)
        courier_payment = serializer.validated_data.get("courier_payment", None)
        # Рассчитываем новую общую стоимость заказа. Логика такая:
        # 1. Если менялась цена заказа (price is not None), то берём её; иначе берём старую цену заказа.
        # 2. Если менялась оплата курьеру (courier_payment is not None),
        # то берём её; иначе берём старую оплату курьеру.
        # 3. Пихаем всё в список, считаем сумму элементов в нём => получаем новую стоимость заказа.
        new_order_price = sum(
            [
                price if price is not None else order.price,
                courier_payment
                if courier_payment is not None
                else order.courier_payment,
            ]
        )
        # Выбираем все заказы текущего заказчика, среди них нас интересуют
        # только их цены и оплаты курьеру. Получаем список вида:
        # [(price, courier_payment), (price, courier_payment),(price, courier_payment), ...]
        order_prices = (
            Order.objects.filter(sender=request.user)
            .exclude(pk=order.pk)  # МЫ НЕ ВЫБИРАЕМ ТЕКУЩИЙ (обновляемый) ЗАКАЗ
            .values_list("price", "courier_payment")
        )
        # Сумма ниже рассчитывается БЕЗ текущего (обновляемого) заказа
        total_sender_price = sum([pr + cp for pr, cp in order_prices])
        # Если новая стоимость заказа + сумма всех заказов без текущего больше баланса,
        # то заказчик не в состоянии оплатить все свои заказы
        if request.user.balance < new_order_price + total_sender_price:
            raise ValidationError(
                "Insufficient funds, sender wouldn't be able to pay this order as well."
            )
        # Если денег хватает, обновляем заказ
        instance = serializer.save()
        response_data = GetOrderDetailSerializer(instance).data
        return Response(response_data, 200)

    @action(methods=["delete"], detail=True)
    def delete_sender_order(self, request, pk=None):
        if not Order.objects.filter(pk=pk, sender=request.user).exists():
            raise ValidationError("No such order belonging to you.")
        order = Order.objects.get(pk=pk, sender=request.user)
        if CourierAdditionalData.objects.filter(current_order=order).exists():
            raise ValidationError(
                "This order was already taken by some courier, so you can't delete it."
            )
        order_id = order.pk
        order.delete()
        return Response({"success": f"Deleted the order id={order_id}."}, 204)


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated, IsCustomer])
def get_customer_order_history(request):
    queryset = OrderHistory.objects.filter(
        Q(sender=request.user) | Q(recipient=request.user)
    ).order_by("-id")
    response_data = GetCustomerOrderHistorySerializer(
        queryset, many=True, context={"request": request}
    ).data
    return Response(response_data, 200)
