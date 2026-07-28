from apexhub.providers.vault.services.secret.secret_service import Secret
from apexhub.providers.common.provider import Provider

secret_client = Secret(Provider.get_global_provider())
