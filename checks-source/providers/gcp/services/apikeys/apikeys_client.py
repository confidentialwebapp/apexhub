from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.apikeys.apikeys_service import APIKeys

apikeys_client = APIKeys(Provider.get_global_provider())
