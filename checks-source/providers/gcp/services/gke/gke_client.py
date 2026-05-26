from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.gke.gke_service import GKE

gke_client = GKE(Provider.get_global_provider())
