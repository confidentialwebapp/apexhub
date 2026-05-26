from apexhub.providers.azure.services.storage.storage_service import Storage
from apexhub.providers.common.provider import Provider

storage_client = Storage(Provider.get_global_provider())
