from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.purview.purview_service import Purview

purview_client = Purview(Provider.get_global_provider())
