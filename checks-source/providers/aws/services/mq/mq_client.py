from apexhub.providers.aws.services.mq.mq_service import MQ
from apexhub.providers.common.provider import Provider

mq_client = MQ(Provider.get_global_provider())
