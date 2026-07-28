from apexhub.providers.terraformcloud.services.workspace.workspace_service import Workspace
from apexhub.providers.common.provider import Provider

workspace_client = Workspace(Provider.get_global_provider())
