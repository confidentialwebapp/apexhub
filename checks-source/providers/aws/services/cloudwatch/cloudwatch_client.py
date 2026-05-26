from apexhub.providers.aws.services.cloudwatch.cloudwatch_service import CloudWatch
from apexhub.providers.common.provider import Provider

cloudwatch_client = CloudWatch(Provider.get_global_provider())
