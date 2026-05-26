from apexhub.providers.aws.services.glue.glue_service import Glue
from apexhub.providers.common.provider import Provider

glue_client = Glue(Provider.get_global_provider())
