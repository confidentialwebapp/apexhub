from apexhub.providers.aws.services.secretsmanager.secretsmanager_service import (
    SecretsManager,
)
from apexhub.providers.common.provider import Provider

secretsmanager_client = SecretsManager(Provider.get_global_provider())
