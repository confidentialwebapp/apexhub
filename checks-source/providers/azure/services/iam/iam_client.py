from apexhub.providers.azure.services.iam.iam_service import IAM
from apexhub.providers.common.provider import Provider

iam_client = IAM(Provider.get_global_provider())
