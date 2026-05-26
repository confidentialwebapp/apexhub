from apexhub.providers.alibabacloud.services.sls.sls_service import Sls
from apexhub.providers.common.provider import Provider

sls_client = Sls(Provider.get_global_provider())
