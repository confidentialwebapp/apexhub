from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.scheduler.scheduler_service import Scheduler

scheduler_client = Scheduler(Provider.get_global_provider())
