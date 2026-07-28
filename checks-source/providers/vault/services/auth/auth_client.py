from apexhub.providers.vault.services.auth.auth_service import Auth
from apexhub.providers.common.provider import Provider

auth_client = Auth(Provider.get_global_provider())
