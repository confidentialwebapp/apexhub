from apexhub.providers.alibabacloud.services.oss.oss_service import OSS
from apexhub.providers.common.provider import Provider

oss_client = OSS(Provider.get_global_provider())
