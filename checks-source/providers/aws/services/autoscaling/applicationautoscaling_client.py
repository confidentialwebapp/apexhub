from apexhub.providers.aws.services.autoscaling.autoscaling_service import (
    ApplicationAutoScaling,
)
from apexhub.providers.common.provider import Provider

applicationautoscaling_client = ApplicationAutoScaling(Provider.get_global_provider())
