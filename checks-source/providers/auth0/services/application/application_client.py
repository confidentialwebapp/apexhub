from apexhub.providers.auth0.services.application.application_service import Application
from apexhub.providers.common.provider import Provider

application_client = Application(Provider.get_global_provider())
