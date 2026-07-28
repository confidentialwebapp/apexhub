from apexhub.providers.bitbucket.services.repository.repository_service import Repository
from apexhub.providers.common.provider import Provider

repository_client = Repository(Provider.get_global_provider())
