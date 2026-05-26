from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.intune.intune_service import Intune

intune_client = Intune(Provider.get_global_provider())
