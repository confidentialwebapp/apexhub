from apexhub.providers.slack.services.channel.channel_service import Channel
from apexhub.providers.common.provider import Provider

channel_client = Channel(Provider.get_global_provider())
