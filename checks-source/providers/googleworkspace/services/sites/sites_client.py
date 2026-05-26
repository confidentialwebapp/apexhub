from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.sites.sites_service import (
    Sites,
)

sites_client = Sites(Provider.get_global_provider())
