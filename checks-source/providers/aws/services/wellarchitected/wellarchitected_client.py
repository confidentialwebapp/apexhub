from apexhub.providers.aws.services.wellarchitected.wellarchitected_service import (
    WellArchitected,
)
from apexhub.providers.common.provider import Provider

wellarchitected_client = WellArchitected(Provider.get_global_provider())
