from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.cloudresourcemanager.cloudresourcemanager_service import (
    CloudResourceManager,
)

cloudresourcemanager_client = CloudResourceManager(Provider.get_global_provider())
