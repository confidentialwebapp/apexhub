from apexhub.providers.aws.services.appstream.appstream_service import AppStream
from apexhub.providers.common.provider import Provider

appstream_client = AppStream(Provider.get_global_provider())
