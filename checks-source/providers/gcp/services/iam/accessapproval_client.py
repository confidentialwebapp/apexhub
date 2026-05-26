from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.iam.iam_service import AccessApproval

accessapproval_client = AccessApproval(Provider.get_global_provider())
