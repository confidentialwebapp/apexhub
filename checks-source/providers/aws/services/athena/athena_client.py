from apexhub.providers.aws.services.athena.athena_service import Athena
from apexhub.providers.common.provider import Provider

athena_client = Athena(Provider.get_global_provider())
