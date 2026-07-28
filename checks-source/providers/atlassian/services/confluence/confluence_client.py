from apexhub.providers.atlassian.services.confluence.confluence_service import Confluence
from apexhub.providers.common.provider import Provider

confluence_client = Confluence(Provider.get_global_provider())
