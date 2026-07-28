from apexhub.providers.atlassian.services.jira.jira_service import Jira
from apexhub.providers.common.provider import Provider

jira_client = Jira(Provider.get_global_provider())
