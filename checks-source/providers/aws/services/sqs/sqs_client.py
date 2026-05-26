from apexhub.providers.aws.services.sqs.sqs_service import SQS
from apexhub.providers.common.provider import Provider

sqs_client = SQS(Provider.get_global_provider())
