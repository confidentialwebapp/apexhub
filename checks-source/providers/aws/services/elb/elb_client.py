from apexhub.providers.aws.services.elb.elb_service import ELB
from apexhub.providers.common.provider import Provider

elb_client = ELB(Provider.get_global_provider())
