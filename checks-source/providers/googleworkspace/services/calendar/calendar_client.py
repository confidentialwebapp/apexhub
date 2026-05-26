from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.calendar.calendar_service import (
    Calendar,
)

calendar_client = Calendar(Provider.get_global_provider())
