from apexhub.providers.auth0.services.tenant.tenant_service import Tenant
from apexhub.providers.common.provider import Provider

tenant_client = Tenant(Provider.get_global_provider())
