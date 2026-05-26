from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.kms.kms_service import KMS

kms_client = KMS(Provider.get_global_provider())
