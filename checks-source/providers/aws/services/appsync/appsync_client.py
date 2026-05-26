from apexhub.providers.aws.services.appsync.appsync_service import AppSync
from apexhub.providers.common.provider import Provider

appsync_client = AppSync(Provider.get_global_provider())
