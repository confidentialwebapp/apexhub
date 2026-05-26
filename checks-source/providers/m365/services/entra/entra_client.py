from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.entra.entra_service import Entra

entra_client = Entra(Provider.get_global_provider())
