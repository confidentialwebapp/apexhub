# Exception codes from 14900 to 15899 are reserved for Auth0.
from apexhub.exceptions.exceptions import ApexHubException


class Auth0BaseException(ApexHubException):
    """Base exception for Auth0 provider errors."""

    AUTH0_ERROR_CODES = {
        (14900, "Auth0CredentialsError"): {
            "message": "Auth0 credentials not found or invalid.",
            "remediation": "Set AUTH0_DOMAIN and AUTH0_TOKEN to a Management API token for a machine-to-machine application granted read:clients, read:connections, read:tenant_settings, read:log_streams and read:attack_protection.",
        },
        (14901, "Auth0AuthenticationError"): {
            "message": "Authentication to the Auth0 API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14902, "Auth0SessionError"): {
            "message": "Failed to create a Auth0 API session.",
            "remediation": "Check network connectivity and ensure https://<tenant>.auth0.com is reachable.",
        },
        (14903, "Auth0IdentityError"): {
            "message": "Failed to retrieve Auth0 identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14904, "Auth0APIError"): {
            "message": "An error occurred while calling the Auth0 API.",
            "remediation": "Check the Auth0 status page and retry the request.",
        },
        (14905, "Auth0RateLimitError"): {
            "message": "Rate limited by the Auth0 API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.AUTH0_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Auth0",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class Auth0CredentialsError(Auth0BaseException):
    """Credentials Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14900,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class Auth0AuthenticationError(Auth0BaseException):
    """Authentication Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14901,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class Auth0SessionError(Auth0BaseException):
    """Session Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14902,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class Auth0IdentityError(Auth0BaseException):
    """Identity Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14903,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class Auth0APIError(Auth0BaseException):
    """A P I Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14904,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class Auth0RateLimitError(Auth0BaseException):
    """Rate Limit Error for the Auth0 provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14905,
            file=file,
            original_exception=original_exception,
            message=message,
        )
