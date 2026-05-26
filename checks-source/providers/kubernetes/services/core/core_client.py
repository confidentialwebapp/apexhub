from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.core.core_service import Core

core_client = Core(Provider.get_global_provider())
