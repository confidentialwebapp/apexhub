from apexhub.providers.alibabacloud.services.ecs.ecs_service import ECS
from apexhub.providers.common.provider import Provider

ecs_client = ECS(Provider.get_global_provider())
