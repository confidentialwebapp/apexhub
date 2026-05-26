from apexhub.providers.aws.services.transfer.transfer_service import Transfer
from apexhub.providers.common.provider import Provider

transfer_client = Transfer(Provider.get_global_provider())
