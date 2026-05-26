from apexhub.providers.common.provider import Provider
from apexhub.providers.okta.services.signon.signon_service import Signon

signon_client = Signon(Provider.get_global_provider())
