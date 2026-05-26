from apexhub.providers.aws.services.elasticbeanstalk.elasticbeanstalk_service import (
    ElasticBeanstalk,
)
from apexhub.providers.common.provider import Provider

elasticbeanstalk_client = ElasticBeanstalk(Provider.get_global_provider())
