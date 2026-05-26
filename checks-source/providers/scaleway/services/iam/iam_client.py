from apexhub.providers.common.provider import Provider
from apexhub.providers.scaleway.services.iam.iam_service import IAM

iam_client = IAM(Provider.get_global_provider())
