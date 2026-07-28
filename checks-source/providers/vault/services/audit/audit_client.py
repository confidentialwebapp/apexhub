from apexhub.providers.vault.services.audit.audit_service import Audit
from apexhub.providers.common.provider import Provider

audit_client = Audit(Provider.get_global_provider())
