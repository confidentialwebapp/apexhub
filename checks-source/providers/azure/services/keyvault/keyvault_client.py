from apexhub.providers.azure.services.keyvault.keyvault_service import KeyVault
from apexhub.providers.common.provider import Provider

keyvault_client = KeyVault(Provider.get_global_provider())
