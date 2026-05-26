from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.dns.dns_service import DNS

dns_client = DNS(Provider.get_global_provider())
