from apexhub.providers.aws.services.resourceexplorer2.resourceexplorer2_service import (
    ResourceExplorer2,
)
from apexhub.providers.common.provider import Provider

resource_explorer_2_client = ResourceExplorer2(Provider.get_global_provider())
