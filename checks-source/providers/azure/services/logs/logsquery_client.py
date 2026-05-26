from apexhub.providers.azure.services.logs.logs_service import LogsQuery
from apexhub.providers.common.provider import Provider

logsquery_client = LogsQuery(Provider.get_global_provider())
