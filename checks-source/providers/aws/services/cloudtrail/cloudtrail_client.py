from apexhub.providers.aws.services.cloudtrail.cloudtrail_service import Cloudtrail
from apexhub.providers.common.provider import Provider

cloudtrail_client = Cloudtrail(Provider.get_global_provider())
