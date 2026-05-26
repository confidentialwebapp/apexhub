from apexhub.providers.cloudflare.services.zone.zone_service import Zone
from apexhub.providers.common.provider import Provider

zone_client = Zone(Provider.get_global_provider())
