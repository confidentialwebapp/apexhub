from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.defender.defender_service import Defender

defender_client = Defender(Provider.get_global_provider())
