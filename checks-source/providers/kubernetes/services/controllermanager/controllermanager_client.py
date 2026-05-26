from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.controllermanager.controllermanager_service import (
    ControllerManager,
)

controllermanager_client = ControllerManager(Provider.get_global_provider())
