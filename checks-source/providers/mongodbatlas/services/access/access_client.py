from apexhub.providers.mongodbatlas.services.access.access_service import Access
from apexhub.providers.common.provider import Provider

access_client = Access(Provider.get_global_provider())
