from apexhub.providers.github.services.security.security_service import Security
from apexhub.providers.common.provider import Provider

security_client = Security(Provider.get_global_provider())
