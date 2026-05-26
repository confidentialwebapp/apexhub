from apexhub.providers.azure.services.monitor.monitor_service import Monitor
from apexhub.providers.common.provider import Provider

monitor_client = Monitor(Provider.get_global_provider())
