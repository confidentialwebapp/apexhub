from apexhub.providers.aws.services.globalaccelerator.globalaccelerator_service import (
    GlobalAccelerator,
)
from apexhub.providers.common.provider import Provider

globalaccelerator_client = GlobalAccelerator(Provider.get_global_provider())
