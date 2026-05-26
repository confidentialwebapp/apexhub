from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.filestorage.filestorage_service import (
    Filestorage,
)

filestorage_client = Filestorage(Provider.get_global_provider())
