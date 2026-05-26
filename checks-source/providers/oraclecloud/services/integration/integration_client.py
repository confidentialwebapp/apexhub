"""OCI Integration client."""

from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.integration.integration_service import (
    Integration,
)

integration_client = Integration(Provider.get_global_provider())
