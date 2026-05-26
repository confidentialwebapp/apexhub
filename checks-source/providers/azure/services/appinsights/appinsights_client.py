from apexhub.providers.azure.services.appinsights.appinsights_service import AppInsights
from apexhub.providers.common.provider import Provider

appinsights_client = AppInsights(Provider.get_global_provider())
