from apexhub.providers.common.provider import Provider
from apexhub.providers.gcp.services.bigquery.bigquery_service import BigQuery

bigquery_client = BigQuery(Provider.get_global_provider())
