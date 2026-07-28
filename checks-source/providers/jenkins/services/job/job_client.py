from apexhub.providers.jenkins.services.job.job_service import Job
from apexhub.providers.common.provider import Provider

job_client = Job(Provider.get_global_provider())
