from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.project.project_service import Project

project_client = Project(Provider.get_global_provider())
