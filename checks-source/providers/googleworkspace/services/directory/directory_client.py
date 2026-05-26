from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.directory.directory_service import (
    Directory,
)

directory_client = Directory(Provider.get_global_provider())
