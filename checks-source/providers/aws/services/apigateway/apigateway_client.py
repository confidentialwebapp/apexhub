from apexhub.providers.aws.services.apigateway.apigateway_service import APIGateway
from apexhub.providers.common.provider import Provider

apigateway_client = APIGateway(Provider.get_global_provider())
