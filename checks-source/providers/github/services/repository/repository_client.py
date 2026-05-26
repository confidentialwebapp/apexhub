from apexhub.providers.common.provider import Provider
from apexhub.providers.github.services.repository.repository_service import Repository

repository_client = Repository(Provider.get_global_provider())
