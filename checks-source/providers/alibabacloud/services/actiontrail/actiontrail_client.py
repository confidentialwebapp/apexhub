from apexhub.providers.alibabacloud.services.actiontrail.actiontrail_service import (
    ActionTrail,
)
from apexhub.providers.common.provider import Provider

actiontrail_client = ActionTrail(Provider.get_global_provider())
