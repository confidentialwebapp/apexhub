from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.network.network_service import Network

network_client = Network(Provider.get_global_provider())
