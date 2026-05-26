from apexhub.providers.azure.services.network.network_service import Network
from apexhub.providers.common.provider import Provider

network_client = Network(Provider.get_global_provider())
