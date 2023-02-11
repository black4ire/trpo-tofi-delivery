from django.contrib.auth.hashers import check_password
from rest_framework import serializers
from rest_framework.serializers import ModelSerializer, Serializer, ValidationError

from delivery.models import (
    CourierAdditionalData,
    Order,
    OrderHistory,
    TransactionHistory,
    User,
)
from delivery.utils import validate_time
from delivery.validators import validate_password


class RegisterUserSerializer(ModelSerializer):
    confirmation_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = (
            "full_name",
            "phone",
            "email",
            "password",
            "confirmation_password",
            "is_courier",
        )
        extra_kwargs = {
            "password": {"write_only": True, "validators": [validate_password]},
            "is_courier": {"required": True},
        }

    def create(self, validated_data):
        validated_data.pop("confirmation_password")
        is_courier = validated_data.pop("is_courier")
        full_name = validated_data.pop("full_name")
        email = validated_data.pop("email")
        phone = validated_data.pop("phone")
        password = validated_data.pop("password")
        user = User.objects.create_user(
            full_name, phone, email, password, **validated_data
        )
        user.is_courier = is_courier
        user.save()
        if is_courier:
            CourierAdditionalData.objects.create(current_order=None, user=user)
        return user

    def validate(self, raw_data):
        if raw_data["password"] != raw_data["confirmation_password"]:
            raise serializers.ValidationError("Passwords don't match!")
        return raw_data


class UpdateEmailSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ("email",)

    def __init__(self, *args, **kwargs):
        kwargs["partial"] = True
        super(UpdateEmailSerializer, self).__init__(*args, **kwargs)


class ChangePasswordSerializer(ModelSerializer):
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )
    confirmation_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ("password", "new_password", "confirmation_password")
        extra_kwargs = {"password": {"write_only": True}}

    def __init__(self, *args, **kwargs):
        kwargs["partial"] = True
        super(ChangePasswordSerializer, self).__init__(*args, **kwargs)

    def validate(self, raw_data):
        if any(list(map(lambda x: x not in raw_data, self.Meta.fields))):
            raise ValidationError("No fields were provided.")
        if not check_password(raw_data["password"], self.instance.password):
            raise serializers.ValidationError("Old password is incorrect!")
        if check_password(raw_data["new_password"], self.instance.password):
            raise serializers.ValidationError(
                "Changing to the same password is not allowed!"
            )
        if raw_data["new_password"] != raw_data["confirmation_password"]:
            raise serializers.ValidationError("New passwords don't match!")
        return raw_data

    def save(self):
        self.instance.set_password(self.validated_data["new_password"])
        self.instance.save()
        return self.instance


class UserInfoSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ("email", "full_name", "phone", "is_courier", "balance")
        read_only_fields = ("email", "is_courier", "balance")


class UserTopUpBalanceSerializer(Serializer):
    sum_to_add = serializers.DecimalField(7, 2, min_value=0.01)


#
#
# COURIER
#
#
class GetOrderListSerializer(ModelSerializer):
    sender = serializers.StringRelatedField()
    recipient = serializers.StringRelatedField()

    class Meta:
        model = Order
        fields = (
            "id",
            "name",
            "price",
            "weight",
            "address_from",
            "address_to",
            "sender",
            "recipient",
            "time_to_pickup",
            "time_to_deliver",
            "courier_payment",
        )


class GetOrderDetailSerializer(ModelSerializer):
    sender = serializers.StringRelatedField()
    recipient = serializers.StringRelatedField()

    class Meta:
        model = Order
        fields = (
            "id",
            "name",
            "price",
            "detail",
            "weight",
            "address_from",
            "address_to",
            "sender",
            "recipient",
            "time_to_pickup",
            "time_to_deliver",
            "courier_payment",
        )


class PostOrderSerializer(ModelSerializer):
    recipient = serializers.CharField(max_length=30)

    class Meta:
        model = Order
        fields = (
            "name",
            "price",
            "detail",
            "weight",
            "address_from",
            "address_to",
            "recipient",
            "time_to_pickup",
            "time_to_deliver",
            "courier_payment",
        )

    def validate(self, raw_data):
        sender_phone = self.context["request"].user.phone
        recipient_phone = raw_data["recipient"].strip()
        if not User.objects.filter(
            phone=recipient_phone, user_courier_data__isnull=True
        ).exists():
            raise ValidationError(f"Customer phone {recipient_phone} does not exist.")
        if sender_phone == recipient_phone:
            raise ValidationError("Same phone numbers are not allowed!")
        raw_data["sender"] = self.context["request"].user
        raw_data["recipient"] = User.objects.get(
            phone=recipient_phone, user_courier_data__isnull=True
        )
        validate_time(raw_data)
        return raw_data

    def create(self, validated_data):
        instance = super().create(validated_data)
        return instance


class PartialUpdateOrderSerializer(ModelSerializer):
    recipient = serializers.CharField(max_length=30)

    class Meta:
        model = Order
        fields = (
            "name",
            "price",
            "detail",
            "weight",
            "address_from",
            "address_to",
            "recipient",
            "courier_payment",
        )

    def validate(self, raw_data):
        sender_phone = self.context["request"].user.phone
        recipient_phone = raw_data.get("recipient", None)
        if recipient_phone is not None:
            recipient_phone = recipient_phone.strip()
        if (
            recipient_phone is not None
            and not User.objects.filter(
                phone=recipient_phone, user_courier_data__isnull=True
            ).exists()
        ):
            raise ValidationError(f"Customer phone {recipient_phone} does not exist.")
        if recipient_phone is not None and sender_phone == recipient_phone:
            raise ValidationError("Same phone numbers are not allowed!")
        if recipient_phone is not None:
            raw_data["recipient"] = User.objects.get(
                phone=recipient_phone, user_courier_data__isnull=True
            )
        return raw_data

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        return instance


class GetCourierOrderHistorySerializer(ModelSerializer):
    sender = serializers.StringRelatedField()
    recipient = serializers.StringRelatedField()
    courier = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = OrderHistory
        fields = (
            "id",
            "name",
            "price",
            "detail",
            "weight",
            "address_from",
            "address_to",
            "sender",
            "recipient",
            "courier",
            "time_to_pickup",
            "time_to_deliver",
            "courier_payment",
            "status",
        )

    def get_courier(self, obj):
        if obj.courier is None:
            return None
        return str(obj.courier)

    def get_status(self, obj):
        return "Done"


class GetCustomerOrderHistorySerializer(ModelSerializer):
    sender = serializers.StringRelatedField()
    recipient = serializers.StringRelatedField()
    courier = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = OrderHistory
        fields = (
            "id",
            "name",
            "price",
            "detail",
            "weight",
            "address_from",
            "address_to",
            "sender",
            "recipient",
            "courier",
            "time_to_pickup",
            "time_to_deliver",
            "courier_payment",
            "status",
        )

    def get_courier(self, obj):
        if obj.courier is None:
            return None
        return str(obj.courier)

    def get_status(self, obj):
        if obj.sender == self.context["request"].user:
            return "Sent"
        return "Acquired"


class GetTransactionHistorySerializer(ModelSerializer):
    class Meta:
        model = TransactionHistory
        fields = "__all__"
