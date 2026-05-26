from apexhub.providers.azure.services.logs.logs_service import LogAnalytics
from apexhub.providers.common.provider import Provider

loganalytics_client = LogAnalytics(Provider.get_global_provider())
