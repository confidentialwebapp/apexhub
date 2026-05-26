from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.security.security_service import Security

security_client = Security(Provider.get_global_provider())
