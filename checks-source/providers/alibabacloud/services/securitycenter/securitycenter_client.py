from apexhub.providers.alibabacloud.services.securitycenter.securitycenter_service import (
    SecurityCenter,
)
from apexhub.providers.common.provider import Provider

securitycenter_client = SecurityCenter(Provider.get_global_provider())
