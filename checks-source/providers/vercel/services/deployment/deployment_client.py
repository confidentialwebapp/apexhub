from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.deployment.deployment_service import Deployment

deployment_client = Deployment(Provider.get_global_provider())
