from apexhub.providers.aws.services.acm.acm_service import ACM
from apexhub.providers.common.provider import Provider

acm_client = ACM(Provider.get_global_provider())
