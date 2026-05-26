from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.sharepoint.sharepoint_service import SharePoint

sharepoint_client = SharePoint(Provider.get_global_provider())
