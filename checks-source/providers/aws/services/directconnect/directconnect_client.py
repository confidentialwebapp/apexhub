from apexhub.providers.aws.services.directconnect.directconnect_service import (
    DirectConnect,
)
from apexhub.providers.common.provider import Provider

directconnect_client = DirectConnect(Provider.get_global_provider())
