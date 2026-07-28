from apexhub.providers.gitlab.services.project.project_service import Project
from apexhub.providers.common.provider import Provider

project_client = Project(Provider.get_global_provider())
