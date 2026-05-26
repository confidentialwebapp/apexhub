from apexhub.providers.common.provider import Provider
from apexhub.providers.m365.services.exchange.exchange_service import Exchange

exchange_client = Exchange(Provider.get_global_provider())
