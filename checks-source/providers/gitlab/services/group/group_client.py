from apexhub.providers.gitlab.services.group.group_service import Group
from apexhub.providers.common.provider import Provider

group_client = Group(Provider.get_global_provider())
