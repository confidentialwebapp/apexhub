from apexhub.providers.aws.services.datasync.datasync_service import DataSync
from apexhub.providers.common.provider import Provider

datasync_client = DataSync(Provider.get_global_provider())
