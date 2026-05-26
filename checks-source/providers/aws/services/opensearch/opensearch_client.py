from apexhub.providers.aws.services.opensearch.opensearch_service import (
    OpenSearchService,
)
from apexhub.providers.common.provider import Provider

opensearch_client = OpenSearchService(Provider.get_global_provider())
