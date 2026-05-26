from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.drive.drive_service import Drive

drive_client = Drive(Provider.get_global_provider())
