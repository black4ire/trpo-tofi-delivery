# Create your models here.
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.contrib.gis.db import models
from django.core.validators import MinValueValidator

# from django.db import models
# from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# MODELS
class UserManager(BaseUserManager):
    """Define a model manager for User model with no username field."""

    use_in_migrations = True

    def _create_user(self, full_name, phone, email, password, **extra_fields):
        """Create and save a User with the given full_name, phone, email and password."""
        if not email:
            raise ValueError("The given email must be set")
        email = self.normalize_email(email)
        user = self.model(full_name=full_name, phone=phone, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, full_name, phone, email, password=None, **extra_fields):
        """Create and save a regular User with the given full_name, phone, email and password."""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(full_name, phone, email, password, **extra_fields)

    def create_superuser(self, full_name, phone, email, password, **extra_fields):
        """Create and save a SuperUser with the given full_name, phone, email and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(full_name, phone, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model."""

    full_name = models.CharField(_("full name"), max_length=300, blank=True)
    phone = models.CharField(_("phone number"), max_length=30, blank=False, unique=True)
    email = models.EmailField(unique=True)
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    is_courier = models.BooleanField(_("courier status"), default=False)
    balance = models.DecimalField(
        _("balance"),
        max_digits=9,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name", "password", "email"]

    objects = UserManager()

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email)

    def __str__(self):
        return self.email + " " + self.phone


class Order(models.Model):
    name = models.CharField(max_length=300)
    price = models.DecimalField(max_digits=7, decimal_places=2)
    detail = models.TextField()
    weight = models.PositiveIntegerField()
    address_from = models.CharField(max_length=300)
    address_to = models.CharField(max_length=300)
    sender = models.ForeignKey(
        to=User, on_delete=models.CASCADE, related_name="sender_orders"
    )
    recipient = models.ForeignKey(
        to=User, on_delete=models.CASCADE, related_name="recipient_orders"
    )
    time_to_pickup = models.DateTimeField()
    time_to_deliver = models.DateTimeField()
    courier_payment = models.DecimalField(max_digits=7, decimal_places=2)

    def __str__(self):
        return f"From: {self.sender}; To: {self.recipient}; Name: {self.name}"


class CourierAdditionalData(models.Model):
    user = models.OneToOneField(
        to=User, on_delete=models.CASCADE, related_name="user_courier_data"
    )
    current_order = models.OneToOneField(
        to=Order,
        on_delete=models.SET_NULL,
        null=True,
        related_name="order_courier_data",
    )

    def __str__(self):
        return self.user.email + " additional data"


class OrderHistory(models.Model):
    name = models.CharField(max_length=300)
    price = models.DecimalField(max_digits=7, decimal_places=2)
    detail = models.TextField()
    weight = models.PositiveIntegerField()
    address_from = models.CharField(max_length=300)
    address_to = models.CharField(max_length=300)
    sender = models.ForeignKey(
        to=User,
        on_delete=models.SET_NULL,
        related_name="sender_processed_order",
        null=True,
    )
    recipient = models.ForeignKey(
        to=User,
        on_delete=models.SET_NULL,
        related_name="recipient_processed_order",
        null=True,
    )
    courier = models.ForeignKey(
        to=User,
        on_delete=models.CASCADE,
        related_name="courier_processed_order",
        null=True,
    )
    time_to_pickup = models.DateTimeField()
    time_to_deliver = models.DateTimeField()
    courier_payment = models.DecimalField(max_digits=7, decimal_places=2)

    def __str__(self):
        return f"From: {self.sender}; To: {self.recipient}; Name: {self.name}"


class TransactionHistory(models.Model):
    time_happened = models.DateTimeField(auto_now_add=True)
    description = models.TextField()
    cost = models.DecimalField(max_digits=7, decimal_places=2)
    user = models.ForeignKey(to=User, on_delete=models.CASCADE)
    braintree_id = models.CharField(max_length=150)

    def __str__(self):
        return f"Transaction '{self.braintree_id}', add balance to {self.user}"
