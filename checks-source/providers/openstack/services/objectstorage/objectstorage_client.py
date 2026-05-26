from apexhub.providers.common.provider import Provider
from apexhub.providers.openstack.services.objectstorage.objectstorage_service import (
    ObjectStorage,
)

objectstorage_client = ObjectStorage(Provider.get_global_provider())
