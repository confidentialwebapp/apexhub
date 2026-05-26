from apexhub.providers.common.provider import Provider
from apexhub.providers.github.services.organization.organization_service import (
    Organization,
)

organization_client = Organization(Provider.get_global_provider())
