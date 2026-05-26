from apexhub.providers.aws.services.dynamodb.dynamodb_service import DAX
from apexhub.providers.common.provider import Provider

dax_client = DAX(Provider.get_global_provider())
