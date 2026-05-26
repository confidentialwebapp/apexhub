from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.domain.domain_service import Domain

domain_client = Domain(Provider.get_global_provider())
