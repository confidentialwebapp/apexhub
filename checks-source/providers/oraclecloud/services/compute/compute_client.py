from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.compute.compute_service import Compute

compute_client = Compute(Provider.get_global_provider())
