from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.gmail.gmail_service import Gmail

gmail_client = Gmail(Provider.get_global_provider())
