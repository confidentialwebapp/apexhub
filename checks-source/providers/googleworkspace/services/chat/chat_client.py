from apexhub.providers.common.provider import Provider
from apexhub.providers.googleworkspace.services.chat.chat_service import Chat

chat_client = Chat(Provider.get_global_provider())
