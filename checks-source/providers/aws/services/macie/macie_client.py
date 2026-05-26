from apexhub.providers.aws.services.macie.macie_service import Macie
from apexhub.providers.common.provider import Provider

macie_client = Macie(Provider.get_global_provider())
