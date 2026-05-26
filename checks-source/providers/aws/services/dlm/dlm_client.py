from apexhub.providers.aws.services.dlm.dlm_service import DLM
from apexhub.providers.common.provider import Provider

dlm_client = DLM(Provider.get_global_provider())
