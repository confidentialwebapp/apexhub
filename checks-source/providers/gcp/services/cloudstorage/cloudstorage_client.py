from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.cloudstorage.cloudstorage_service import (
    CloudStorage,
)

cloudstorage_client = CloudStorage(Provider.get_global_provider())
