from apexhub.providers.aws.services.elasticache.elasticache_service import ElastiCache
from apexhub.providers.common.provider import Provider

elasticache_client = ElastiCache(Provider.get_global_provider())
