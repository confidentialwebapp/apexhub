from apexhub.providers.aws.services.memorydb.memorydb_service import MemoryDB
from apexhub.providers.common.provider import Provider

memorydb_client = MemoryDB(Provider.get_global_provider())
