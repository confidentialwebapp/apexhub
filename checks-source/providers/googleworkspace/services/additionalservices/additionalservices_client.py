from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.additionalservices.additionalservices_service import (
    AdditionalServices,
)

additionalservices_client = AdditionalServices(Provider.get_global_provider())
