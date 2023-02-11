import re

from rest_framework.serializers import ValidationError


def validate_password(password):
    if len(password) < 8 or len(password) > 40:
        raise ValidationError(
            "The password must be at least 8 symbols long and 40 symbols long at max."
        )
    if not re.findall(r"[A-Z]", password):
        raise ValidationError(
            "The password must contain at least 1 uppercase letter, A-Z."
        )
    if not re.findall(r"[a-z]", password):
        raise ValidationError(
            "The password must contain at least 1 lowercase letter, a-z."
        )
    if not re.findall(r"\d", password):
        raise ValidationError("The password must contain at least 1 digit, 0-9.")
    if not re.findall(r"[()\[\]{}|\\`~!@#$%^&*_\-+=;:'\",<>.?]", password):
        raise ValidationError(
            "The password must contain at least 1 special character: "
            + r"()[]{}|`~!@#$%^&*_-+=;:'\",<>.?"
        )
    if re.findall(r"\s", password):
        raise ValidationError("The password must not contain any space characters")
