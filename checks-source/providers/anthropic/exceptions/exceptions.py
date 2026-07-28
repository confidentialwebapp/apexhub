# Exception codes from 14600 to 15599 are reserved for Anthropic Console.
from apexhub.exceptions.exceptions import ApexHubException


class AnthropicBaseException(ApexHubException):
    """Base exception for Anthropic Console provider errors."""

    ANTHROPIC_ERROR_CODES = {
        (14600, "AnthropicCredentialsError"): {
            "message": "Anthropic Console credentials not found or invalid.",
            "remediation": "Set ANTHROPIC_ADMIN_KEY to an Admin API key created under Console > Settings > Admin keys. Standard API keys cannot read organization or workspace configuration.",
        },
        (14601, "AnthropicAuthenticationError"): {
            "message": "Authentication to the Anthropic Console API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14602, "AnthropicSessionError"): {
            "message": "Failed to create a Anthropic Console API session.",
            "remediation": "Check network connectivity and ensure https://api.anthropic.com is reachable.",
        },
        (14603, "AnthropicIdentityError"): {
            "message": "Failed to retrieve Anthropic Console identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14604, "AnthropicAPIError"): {
            "message": "An error occurred while calling the Anthropic Console API.",
            "remediation": "Check the Anthropic Console status page and retry the request.",
        },
        (14605, "AnthropicRateLimitError"): {
            "message": "Rate limited by the Anthropic Console API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.ANTHROPIC_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Anthropic",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class AnthropicCredentialsError(AnthropicBaseException):
    """Credentials Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14600,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AnthropicAuthenticationError(AnthropicBaseException):
    """Authentication Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14601,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AnthropicSessionError(AnthropicBaseException):
    """Session Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14602,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AnthropicIdentityError(AnthropicBaseException):
    """Identity Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14603,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AnthropicAPIError(AnthropicBaseException):
    """A P I Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14604,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class AnthropicRateLimitError(AnthropicBaseException):
    """Rate Limit Error for the Anthropic Console provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14605,
            file=file,
            original_exception=original_exception,
            message=message,
        )
