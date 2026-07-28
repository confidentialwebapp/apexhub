from apexhub.providers.snowflake.services.user.user_service import User
from apexhub.providers.common.provider import Provider

user_client = User(Provider.get_global_provider())
