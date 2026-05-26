from apexhub.providers.aws.services.eks.eks_service import EKS
from apexhub.providers.common.provider import Provider

eks_client = EKS(Provider.get_global_provider())
