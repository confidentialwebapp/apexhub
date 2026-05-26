from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.kms.kms_service import Kms

kms_client = Kms(Provider.get_global_provider())
