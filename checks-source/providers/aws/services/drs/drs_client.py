from apexhub.providers.aws.services.drs.drs_service import DRS
from apexhub.providers.common.provider import Provider

drs_client = DRS(Provider.get_global_provider())
