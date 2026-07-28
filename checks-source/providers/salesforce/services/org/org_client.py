from apexhub.providers.salesforce.services.org.org_service import Org
from apexhub.providers.common.provider import Provider

org_client = Org(Provider.get_global_provider())
