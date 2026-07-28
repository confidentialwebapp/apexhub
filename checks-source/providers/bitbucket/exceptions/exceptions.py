# Exception codes from 14100 to 15099 are reserved for Bitbucket.
from apexhub.exceptions.exceptions import ApexHubException


class BitbucketBaseException(ApexHubException):
    """Base exception for Bitbucket provider errors."""

    BITBUCKET_ERROR_CODES = {
        (14100, "BitbucketCredentialsError"): {
            "message": "Bitbucket credentials not found or invalid.",
            "remediation": "Set BITBUCKET_TOKEN to a workspace access token or app password with repository:read, pipeline:read and account:read scopes.",
        },
        (14101, "BitbucketAuthenticationError"): {
            "message": "Authentication to the Bitbucket API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14102, "BitbucketSessionError"): {
            "message": "Failed to create a Bitbucket API session.",
            "remediation": "Check network connectivity and ensure https://api.bitbucket.org/2.0 is reachable.",
        },
        (14103, "BitbucketIdentityError"): {
            "message": "Failed to retrieve Bitbucket identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14104, "BitbucketAPIError"): {
            "message": "An error occurred while calling the Bitbucket API.",
            "remediation": "Check the Bitbucket status page and retry the request.",
        },
        (14105, "BitbucketRateLimitError"): {
            "message": "Rate limited by the Bitbucket API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.BITBUCKET_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Bitbucket",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class BitbucketCredentialsError(BitbucketBaseException):
    """Credentials Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14100,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class BitbucketAuthenticationError(BitbucketBaseException):
    """Authentication Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14101,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class BitbucketSessionError(BitbucketBaseException):
    """Session Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14102,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class BitbucketIdentityError(BitbucketBaseException):
    """Identity Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14103,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class BitbucketAPIError(BitbucketBaseException):
    """A P I Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14104,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class BitbucketRateLimitError(BitbucketBaseException):
    """Rate Limit Error for the Bitbucket provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14105,
            file=file,
            original_exception=original_exception,
            message=message,
        )
