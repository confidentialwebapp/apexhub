from apexhub.providers.aws.services.ecr.ecr_service import ECR
from apexhub.providers.common.provider import Provider

ecr_client = ECR(Provider.get_global_provider())
