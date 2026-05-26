from apexhub.providers.aws.services.stepfunctions.stepfunctions_service import (
    StepFunctions,
)
from apexhub.providers.common.provider import Provider

stepfunctions_client = StepFunctions(Provider.get_global_provider())
