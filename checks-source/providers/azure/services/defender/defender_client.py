from apexhub.providers.azure.services.defender.defender_service import Defender
from apexhub.providers.common.provider import Provider

defender_client = Defender(Provider.get_global_provider())
