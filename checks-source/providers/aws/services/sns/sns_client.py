from apexhub.providers.aws.services.sns.sns_service import SNS
from apexhub.providers.common.provider import Provider

sns_client = SNS(Provider.get_global_provider())
