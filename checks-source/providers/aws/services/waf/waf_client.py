from apexhub.providers.aws.services.waf.waf_service import WAF
from apexhub.providers.common.provider import Provider

waf_client = WAF(Provider.get_global_provider())
