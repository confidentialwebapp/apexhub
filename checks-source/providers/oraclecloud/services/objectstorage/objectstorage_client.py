from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.objectstorage.objectstorage_service import (
    ObjectStorage,
)

objectstorage_client = ObjectStorage(Provider.get_global_provider())
