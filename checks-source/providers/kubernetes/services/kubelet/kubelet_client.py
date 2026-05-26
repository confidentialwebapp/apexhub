from apexhub.providers.common.provider import Provider
from apexhub.providers.kubernetes.services.kubelet.kubelet_service import Kubelet

kubelet_client = Kubelet(Provider.get_global_provider())
