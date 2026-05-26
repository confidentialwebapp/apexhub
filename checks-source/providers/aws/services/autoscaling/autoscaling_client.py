from apexhub.providers.aws.services.autoscaling.autoscaling_service import AutoScaling
from apexhub.providers.common.provider import Provider

autoscaling_client = AutoScaling(Provider.get_global_provider())
