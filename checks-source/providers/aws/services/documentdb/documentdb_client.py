from apexhub.providers.aws.services.documentdb.documentdb_service import DocumentDB
from apexhub.providers.common.provider import Provider

documentdb_client = DocumentDB(Provider.get_global_provider())
