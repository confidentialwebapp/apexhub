from apexhub.providers.auth0.services.connection.connection_service import Connection
from apexhub.providers.common.provider import Provider

connection_client = Connection(Provider.get_global_provider())
