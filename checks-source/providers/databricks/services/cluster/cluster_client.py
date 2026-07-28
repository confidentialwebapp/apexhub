from apexhub.providers.databricks.services.cluster.cluster_service import Cluster
from apexhub.providers.common.provider import Provider

cluster_client = Cluster(Provider.get_global_provider())
