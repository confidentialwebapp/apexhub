from apexhub.providers.common.provider import Provider
from apexhub.providers.openstack.services.networking.networking_service import (
    Networking,
)

networking_client = Networking(Provider.get_global_provider())
