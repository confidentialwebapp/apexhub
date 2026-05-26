from apexhub.providers.aws.services.networkfirewall.networkfirewall_service import (
    NetworkFirewall,
)
from apexhub.providers.common.provider import Provider

networkfirewall_client = NetworkFirewall(Provider.get_global_provider())
