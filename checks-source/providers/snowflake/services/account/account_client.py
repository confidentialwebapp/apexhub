from apexhub.providers.snowflake.services.account.account_service import Account
from apexhub.providers.common.provider import Provider

account_client = Account(Provider.get_global_provider())
