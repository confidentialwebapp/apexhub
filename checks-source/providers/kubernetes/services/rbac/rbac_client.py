from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.rbac.rbac_service import Rbac

rbac_client = Rbac(Provider.get_global_provider())
