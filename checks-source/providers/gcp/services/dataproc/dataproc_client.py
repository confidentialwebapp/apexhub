from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.dataproc.dataproc_service import Dataproc

dataproc_client = Dataproc(Provider.get_global_provider())
