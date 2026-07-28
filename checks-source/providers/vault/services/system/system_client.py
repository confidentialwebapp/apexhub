from apexhub.providers.vault.services.system.system_service import System
from apexhub.providers.common.provider import Provider

system_client = System(Provider.get_global_provider())
