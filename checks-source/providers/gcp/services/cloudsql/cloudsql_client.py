from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.cloudsql.cloudsql_service import CloudSQL

cloudsql_client = CloudSQL(Provider.get_global_provider())
