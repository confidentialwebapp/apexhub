from apexhub.providers.aws.services.workspaces.workspaces_service import WorkSpaces
from apexhub.providers.common.provider import Provider

workspaces_client = WorkSpaces(Provider.get_global_provider())
