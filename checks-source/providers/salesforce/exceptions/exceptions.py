# Exception codes from 14700 to 15699 are reserved for Salesforce.
from apexhub.exceptions.exceptions import ApexHubException


class SalesforceBaseException(ApexHubException):
    """Base exception for Salesforce provider errors."""

    SALESFORCE_ERROR_CODES = {
        (14700, "SalesforceCredentialsError"): {
            "message": "Salesforce credentials not found or invalid.",
            "remediation": "Set SALESFORCE_INSTANCE_URL and SALESFORCE_TOKEN to an OAuth access token for an integration user holding View Setup and Configuration and API Enabled.",
        },
        (14701, "SalesforceAuthenticationError"): {
            "message": "Authentication to the Salesforce API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14702, "SalesforceSessionError"): {
            "message": "Failed to create a Salesforce API session.",
            "remediation": "Check network connectivity and ensure https://login.salesforce.com is reachable.",
        },
        (14703, "SalesforceIdentityError"): {
            "message": "Failed to retrieve Salesforce identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14704, "SalesforceAPIError"): {
            "message": "An error occurred while calling the Salesforce API.",
            "remediation": "Check the Salesforce status page and retry the request.",
        },
        (14705, "SalesforceRateLimitError"): {
            "message": "Rate limited by the Salesforce API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.SALESFORCE_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Salesforce",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class SalesforceCredentialsError(SalesforceBaseException):
    """Credentials Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14700,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SalesforceAuthenticationError(SalesforceBaseException):
    """Authentication Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14701,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SalesforceSessionError(SalesforceBaseException):
    """Session Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14702,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SalesforceIdentityError(SalesforceBaseException):
    """Identity Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14703,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SalesforceAPIError(SalesforceBaseException):
    """A P I Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14704,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SalesforceRateLimitError(SalesforceBaseException):
    """Rate Limit Error for the Salesforce provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14705,
            file=file,
            original_exception=original_exception,
            message=message,
        )
