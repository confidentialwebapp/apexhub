from apexhub.providers.aws.services.rds.rds_service import RDS
from apexhub.providers.common.provider import Provider

rds_client = RDS(Provider.get_global_provider())
