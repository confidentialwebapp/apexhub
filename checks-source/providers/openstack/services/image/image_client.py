from apexhub.providers.common.provider import Provider
from apexhub.providers.openstack.services.image.image_service import Image

image_client = Image(Provider.get_global_provider())
