from apexhub.providers.azure.services.apim.apim_service import APIM
from apexhub.providers.common.provider import Provider

apim_client = APIM(Provider.get_global_provider())
