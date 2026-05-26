from apexhub.providers.azure.services.sqlserver.sqlserver_service import SQLServer
from apexhub.providers.common.provider import Provider

sqlserver_client = SQLServer(Provider.get_global_provider())
