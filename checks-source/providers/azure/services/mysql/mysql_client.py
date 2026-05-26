from apexhub.providers.azure.services.mysql.mysql_service import MySQL
from apexhub.providers.common.provider import Provider

mysql_client = MySQL(Provider.get_global_provider())
