from apexhub.providers.aws.services.fsx.fsx_service import FSx
from apexhub.providers.common.provider import Provider

fsx_client = FSx(Provider.get_global_provider())
