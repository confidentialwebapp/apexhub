from apexhub.providers.aws.services.eventbridge.eventbridge_service import Schema
from apexhub.providers.common.provider import Provider

schema_client = Schema(Provider.get_global_provider())
