from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.identity.identity_service import Identity

identity_client = Identity(Provider.get_global_provider())
