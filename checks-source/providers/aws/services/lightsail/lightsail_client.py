from apexhub.providers.aws.services.lightsail.lightsail_service import Lightsail
from apexhub.providers.common.provider import Provider

lightsail_client = Lightsail(Provider.get_global_provider())
