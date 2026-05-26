from apexhub.providers.aws.services.ssmincidents.ssmincidents_service import (
    SSMIncidents,
)
from apexhub.providers.common.provider import Provider

ssmincidents_client = SSMIncidents(Provider.get_global_provider())
