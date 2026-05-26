from apexhub.providers.aws.services.redshift.redshift_service import Redshift
from apexhub.providers.common.provider import Provider

redshift_client = Redshift(Provider.get_global_provider())
