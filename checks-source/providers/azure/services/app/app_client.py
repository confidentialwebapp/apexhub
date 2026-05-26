from apexhub.providers.azure.services.app.app_service import App
from apexhub.providers.common.provider import Provider

app_client = App(Provider.get_global_provider())
