from apexhub.providers.jenkins.services.controller.controller_service import Controller
from apexhub.providers.common.provider import Provider

controller_client = Controller(Provider.get_global_provider())
