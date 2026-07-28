# Exception codes from 14500 to 15499 are reserved for OpenAI Platform.
from apexhub.exceptions.exceptions import ApexHubException


class OpenAIBaseException(ApexHubException):
    """Base exception for OpenAI Platform provider errors."""

    OPENAI_ERROR_CODES = {
        (14500, "OpenAICredentialsError"): {
            "message": "OpenAI Platform credentials not found or invalid.",
            "remediation": "Set OPENAI_ADMIN_KEY to an organization admin API key. Generate one under Settings > Organization > Admin keys; a standard project key cannot read organization configuration.",
        },
        (14501, "OpenAIAuthenticationError"): {
            "message": "Authentication to the OpenAI Platform API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14502, "OpenAISessionError"): {
            "message": "Failed to create a OpenAI Platform API session.",
            "remediation": "Check network connectivity and ensure https://api.openai.com is reachable.",
        },
        (14503, "OpenAIIdentityError"): {
            "message": "Failed to retrieve OpenAI Platform identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14504, "OpenAIAPIError"): {
            "message": "An error occurred while calling the OpenAI Platform API.",
            "remediation": "Check the OpenAI Platform status page and retry the request.",
        },
        (14505, "OpenAIRateLimitError"): {
            "message": "Rate limited by the OpenAI Platform API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.OPENAI_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="OpenAI",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class OpenAICredentialsError(OpenAIBaseException):
    """Credentials Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14500,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class OpenAIAuthenticationError(OpenAIBaseException):
    """Authentication Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14501,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class OpenAISessionError(OpenAIBaseException):
    """Session Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14502,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class OpenAIIdentityError(OpenAIBaseException):
    """Identity Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14503,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class OpenAIAPIError(OpenAIBaseException):
    """A P I Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14504,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class OpenAIRateLimitError(OpenAIBaseException):
    """Rate Limit Error for the OpenAI Platform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14505,
            file=file,
            original_exception=original_exception,
            message=message,
        )
