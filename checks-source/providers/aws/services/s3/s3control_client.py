from apexhub.providers.aws.services.s3.s3_service import S3Control
from apexhub.providers.common.provider import Provider

s3control_client = S3Control(Provider.get_global_provider())
