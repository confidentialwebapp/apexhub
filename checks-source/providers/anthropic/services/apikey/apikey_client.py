from apexhub.providers.anthropic.services.apikey.apikey_service import ApiKey
from apexhub.providers.common.provider import Provider

apikey_client = ApiKey(Provider.get_global_provider())
