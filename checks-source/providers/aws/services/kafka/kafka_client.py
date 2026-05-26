from apexhub.providers.aws.services.kafka.kafka_service import Kafka
from apexhub.providers.common.provider import Provider

kafka_client = Kafka(Provider.get_global_provider())
