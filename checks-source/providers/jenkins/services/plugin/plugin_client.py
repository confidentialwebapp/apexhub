from apexhub.providers.jenkins.services.plugin.plugin_service import Plugin
from apexhub.providers.common.provider import Provider

plugin_client = Plugin(Provider.get_global_provider())
