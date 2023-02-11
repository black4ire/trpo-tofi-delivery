from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytz
from django.conf import settings
from rest_framework.serializers import ValidationError
from rest_framework.views import exception_handler

local_tz = pytz.timezone(settings.TIME_ZONE)  # Установка локального часового пояса


def utc_to_local(utc_dt) -> datetime:
    """Преобразовать UTC время в локальное"""
    local_dt = utc_dt.replace(tzinfo=pytz.utc).astimezone(local_tz)
    return local_tz.normalize(local_dt)


def unaware_to_local(dt) -> datetime:
    """Преобразовать время без часового пояса во время с локальным часовым поясом"""
    return dt.replace(tzinfo=ZoneInfo(settings.TIME_ZONE))


def custom_exception_handler(exc, context):
    """Более удобный обработчик исключений Django"""
    newdata = dict()
    newdata["errors"] = []

    def get_list_from_errors(data):
        to_return = []
        if not isinstance(data, (list, dict)):
            to_return.append(data)
        elif isinstance(data, list):
            for err in data:
                to_return.extend(get_list_from_errors(err))
        elif isinstance(data, dict):
            for err in data.values():
                to_return.extend(get_list_from_errors(err))
        return to_return

    response = exception_handler(exc, context)
    if response is not None:
        newdata["errors"].extend(get_list_from_errors(response.data))
        newdata["old_repr"] = response.data
        response.data = newdata
    return response


def validate_time(raw_data):
    if raw_data["time_to_pickup"] <= unaware_to_local(
        datetime.now() + timedelta(minutes=10)
    ) or raw_data["time_to_pickup"] >= unaware_to_local(
        datetime.now() + timedelta(hours=24)
    ):
        raise ValidationError(
            "Invalid time to pickup given. It's supposed to be at least 10 minutes from now &"
            + " not more than 24 hours."
        )
    if raw_data["time_to_pickup"] >= raw_data["time_to_deliver"]:
        raise ValidationError("Invalid times given.")
    if raw_data["time_to_deliver"] <= unaware_to_local(
        datetime.now() + timedelta(minutes=10)
    ) or raw_data["time_to_deliver"] >= unaware_to_local(
        datetime.now() + timedelta(hours=24)
    ):
        raise ValidationError(
            "Invalid time to pickup given. It's supposed to be at least 10 minutes from now &"
            + " not more than 24 hours."
        )
    if raw_data["time_to_deliver"] - raw_data["time_to_pickup"] < timedelta(minutes=10):
        raise ValidationError(
            "Difference between time to deliver & time to pickup is supposed to be"
            + " at least 10 minutes."
        )
