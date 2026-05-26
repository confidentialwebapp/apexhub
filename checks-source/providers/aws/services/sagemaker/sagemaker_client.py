from apexhub.providers.aws.services.sagemaker.sagemaker_service import SageMaker
from apexhub.providers.common.provider import Provider

sagemaker_client = SageMaker(Provider.get_global_provider())
