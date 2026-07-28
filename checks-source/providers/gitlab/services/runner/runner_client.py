from apexhub.providers.gitlab.services.runner.runner_service import Runner
from apexhub.providers.common.provider import Provider

runner_client = Runner(Provider.get_global_provider())
