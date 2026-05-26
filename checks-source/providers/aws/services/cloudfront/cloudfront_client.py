from apexhub.providers.aws.services.cloudfront.cloudfront_service import CloudFront
from apexhub.providers.common.provider import Provider

cloudfront_client = CloudFront(Provider.get_global_provider())
