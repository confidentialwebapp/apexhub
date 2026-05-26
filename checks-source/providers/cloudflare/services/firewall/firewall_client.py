from apexhub.providers.cloudflare.services.firewall.firewall_service import Firewall
from apexhub.providers.common.provider import Provider

firewall_client = Firewall(Provider.get_global_provider())
