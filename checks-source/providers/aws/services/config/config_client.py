from apexhub.providers.aws.services.config.config_service import Config
from apexhub.providers.common.provider import Provider

config_client = Config(Provider.get_global_provider())
