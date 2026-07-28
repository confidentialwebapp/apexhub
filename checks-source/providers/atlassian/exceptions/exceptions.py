# Exception codes from 15000 to 15999 are reserved for Atlassian Cloud.
from apexhub.exceptions.exceptions import ApexHubException


class AtlassianBaseException(ApexHubException):
    """Base exception for Atlassian Cloud provider errors."""

    ATLASSIAN_ERROR_CODES = {
        (15000, "AtlassianCredentialsError"): {
            "message": "Atlassian Cloud credentials not found or invalid.",
            "remediation": "Set ATLASSIAN_ORG_ID, ATLASSIAN_SITE_URL and ATLASSIAN_TOKEN to an organization API key created under Atlassian Administration > Settings > API keys.",
        },
        (15001, "AtlassianAuthenticationError"): {
            "message": "Authentication to the Atlassian Cloud API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (15002, "AtlassianSessionError"): {
            "message": "Failed to create a Atlassian Cloud API session.",
            "remediation": "Check network connectivity and ensure https://api.atlassian.com is reachable.",
        },
        (15003, "AtlassianIdentityError"): {
            "message": "Failed to retrieve Atlassian Cloud identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (15004, "AtlassianAPIError"): {
            "message": "An error occurred while calling the Atlassian Cloud API.",
            "remediation": "Check the Atlassian Cloud status page and retry the request.",
        },
        (15005, "AtlassianRateLimitError"): {
            "message": "Rate limited by the Atlassian Cloud API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.ATLASSIAN_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Atlassian",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class AtlassianCredentialsError(AtlassianBaseException):
    """Credentials Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15000,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AtlassianAuthenticationError(AtlassianBaseException):
    """Authentication Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15001,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AtlassianSessionError(AtlassianBaseException):
    """Session Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15002,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AtlassianIdentityError(AtlassianBaseException):
    """Identity Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15003,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AtlassianAPIError(AtlassianBaseException):
    """A P I Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15004,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AtlassianRateLimitError(AtlassianBaseException):
    """Rate Limit Error for the Atlassian Cloud provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15005,
            file=file,
            original_exception=original_exception,
            message=message,
        )
