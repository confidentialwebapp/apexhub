from apexhub.providers.aws.services.elbv2.elbv2_service import ELBv2
from apexhub.providers.common.provider import Provider

elbv2_client = ELBv2(Provider.get_global_provider())
