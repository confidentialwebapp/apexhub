from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.defenderxdr.defenderxdr_service import DefenderXDR

defenderxdr_client = DefenderXDR(Provider.get_global_provider())
