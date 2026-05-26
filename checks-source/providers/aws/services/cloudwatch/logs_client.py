from apexhub.providers.aws.services.cloudwatch.cloudwatch_service import Logs
from apexhub.providers.common.provider import Provider

logs_client = Logs(Provider.get_global_provider())
