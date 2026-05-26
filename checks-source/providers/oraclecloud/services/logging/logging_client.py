"""OCI Logging Client Module."""

from apexhub.providers.common.provider import Provider
from apexhub.providers.oraclecloud.services.logging.logging_service import Logging

logging_client = Logging(Provider.get_global_provider())
