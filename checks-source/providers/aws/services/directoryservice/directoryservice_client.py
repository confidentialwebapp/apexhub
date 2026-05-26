from apexhub.providers.aws.services.directoryservice.directoryservice_service import (
    DirectoryService,
)
from apexhub.providers.common.provider import Provider

directoryservice_client = DirectoryService(Provider.get_global_provider())
