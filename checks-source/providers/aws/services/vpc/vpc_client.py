from apexhub.providers.aws.services.vpc.vpc_service import VPC
from apexhub.providers.common.provider import Provider

vpc_client = VPC(Provider.get_global_provider())
