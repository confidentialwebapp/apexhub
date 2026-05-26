"""OCI Database client."""

from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.database.database_service import Database

database_client = Database(Provider.get_global_provider())
