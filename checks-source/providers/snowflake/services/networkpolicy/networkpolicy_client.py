from apexhub.providers.snowflake.services.networkpolicy.networkpolicy_service import NetworkPolicy
from apexhub.providers.common.provider import Provider

networkpolicy_client = NetworkPolicy(Provider.get_global_provider())
