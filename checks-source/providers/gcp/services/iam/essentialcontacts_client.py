from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.iam.iam_service import EssentialContacts

essentialcontacts_client = EssentialContacts(Provider.get_global_provider())
