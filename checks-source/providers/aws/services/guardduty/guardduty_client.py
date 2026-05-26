from apexhub.providers.aws.services.guardduty.guardduty_service import GuardDuty
from apexhub.providers.common.provider import Provider

guardduty_client = GuardDuty(Provider.get_global_provider())
