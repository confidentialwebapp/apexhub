from apexhub.providers.aws.services.glacier.glacier_service import Glacier
from apexhub.providers.common.provider import Provider

glacier_client = Glacier(Provider.get_global_provider())
