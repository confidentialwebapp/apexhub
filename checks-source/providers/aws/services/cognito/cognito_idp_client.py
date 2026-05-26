from apexhub.providers.aws.services.cognito.cognito_service import CognitoIDP
from apexhub.providers.common.provider import Provider

cognito_idp_client = CognitoIDP(Provider.get_global_provider())
