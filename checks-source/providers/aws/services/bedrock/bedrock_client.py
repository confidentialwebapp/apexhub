from apexhub.providers.aws.services.bedrock.bedrock_service import Bedrock
from apexhub.providers.common.provider import Provider

bedrock_client = Bedrock(Provider.get_global_provider())
