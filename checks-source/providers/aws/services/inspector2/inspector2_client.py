from apexhub.providers.aws.services.inspector2.inspector2_service import Inspector2
from apexhub.providers.common.provider import Provider

inspector2_client = Inspector2(Provider.get_global_provider())
