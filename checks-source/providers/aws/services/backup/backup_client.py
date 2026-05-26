from apexhub.providers.aws.services.backup.backup_service import Backup
from apexhub.providers.common.provider import Provider

backup_client = Backup(Provider.get_global_provider())
