from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.authentication.authentication_service import (
    Authentication,
)

authentication_client = Authentication(Provider.get_global_provider())
