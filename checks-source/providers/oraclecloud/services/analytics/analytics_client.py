"""OCI Analytics client."""

from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.analytics.analytics_service import Analytics

analytics_client = Analytics(Provider.get_global_provider())
