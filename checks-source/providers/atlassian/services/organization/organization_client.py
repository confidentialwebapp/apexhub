from apexhub.providers.atlassian.services.organization.organization_service import Organization
from apexhub.providers.common.provider import Provider

organization_client = Organization(Provider.get_global_provider())
