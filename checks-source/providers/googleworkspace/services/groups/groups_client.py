from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.groups.groups_service import (
    Groups,
)

groups_client = Groups(Provider.get_global_provider())
