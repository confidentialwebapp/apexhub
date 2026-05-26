from apexhub.providers.alibabacloud.services.ram.ram_service import RAM
from apexhub.providers.common.provider import Provider

ram_client = RAM(Provider.get_global_provider())
