from apexhub.providers.common.provider import Provider
from apexhub.providers.nhn.services.compute.compute_service import NHNComputeService

compute_client = NHNComputeService(Provider.get_global_provider())
