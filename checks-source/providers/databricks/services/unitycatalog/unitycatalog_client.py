from apexhub.providers.databricks.services.unitycatalog.unitycatalog_service import UnityCatalog
from apexhub.providers.common.provider import Provider

unitycatalog_client = UnityCatalog(Provider.get_global_provider())
