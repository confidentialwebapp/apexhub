from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.etcd.etcd_service import Etcd

etcd_client = Etcd(Provider.get_global_provider())
