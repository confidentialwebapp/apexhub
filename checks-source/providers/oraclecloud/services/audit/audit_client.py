from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.audit.audit_service import Audit

audit_client = Audit(Provider.get_global_provider())
