from apexhub.providers.aws.services.s3.s3_service import S3
from apexhub.providers.common.provider import Provider

s3_client = S3(Provider.get_global_provider())
