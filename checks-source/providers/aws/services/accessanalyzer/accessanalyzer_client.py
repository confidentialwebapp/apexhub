from apexhub.providers.aws.services.accessanalyzer.accessanalyzer_service import (
    AccessAnalyzer,
)
from apexhub.providers.common.provider import Provider

accessanalyzer_client = AccessAnalyzer(Provider.get_global_provider())
