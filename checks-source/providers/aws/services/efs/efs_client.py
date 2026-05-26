from apexhub.providers.aws.services.efs.efs_service import EFS
from apexhub.providers.common.provider import Provider

efs_client = EFS(Provider.get_global_provider())
