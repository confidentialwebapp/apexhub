from apexhub.providers.salesforce.services.connectedapp.connectedapp_service import ConnectedApp
from apexhub.providers.common.provider import Provider

connectedapp_client = ConnectedApp(Provider.get_global_provider())
