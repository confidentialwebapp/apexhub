from apexhub.providers.azure.services.postgresql.postgresql_service import PostgreSQL
from apexhub.providers.common.provider import Provider

postgresql_client = PostgreSQL(Provider.get_global_provider())
