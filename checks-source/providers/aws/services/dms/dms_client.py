from apexhub.providers.aws.services.dms.dms_service import DMS
from apexhub.providers.common.provider import Provider

dms_client = DMS(Provider.get_global_provider())
