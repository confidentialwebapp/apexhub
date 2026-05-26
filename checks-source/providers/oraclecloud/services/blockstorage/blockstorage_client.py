from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.blockstorage.blockstorage_service import (
    BlockStorage,
)

blockstorage_client = BlockStorage(Provider.get_global_provider())
