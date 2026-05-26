from apexhub.providers.aws.services.cloudformation.cloudformation_service import (
    CloudFormation,
)
from apexhub.providers.common.provider import Provider

cloudformation_client = CloudFormation(Provider.get_global_provider())
