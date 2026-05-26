from apexhub.providers.aws.services.ses.ses_service import SES
from apexhub.providers.common.provider import Provider

ses_client = SES(Provider.get_global_provider())
