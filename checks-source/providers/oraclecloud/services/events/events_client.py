from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.events.events_service import Events

events_client = Events(Provider.get_global_provider())
