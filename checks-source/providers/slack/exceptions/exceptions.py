# Exception codes from 14800 to 15799 are reserved for Slack.
from apexhub.exceptions.exceptions import ApexHubException


class SlackBaseException(ApexHubException):
    """Base exception for Slack provider errors."""

    SLACK_ERROR_CODES = {
        (14800, "SlackCredentialsError"): {
            "message": "Slack credentials not found or invalid.",
            "remediation": "Set SLACK_TOKEN to a workspace or organization token with admin.apps:read, admin.conversations:read, team:read and auditlogs:read scopes.",
        },
        (14801, "SlackAuthenticationError"): {
            "message": "Authentication to the Slack API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14802, "SlackSessionError"): {
            "message": "Failed to create a Slack API session.",
            "remediation": "Check network connectivity and ensure https://slack.com is reachable.",
        },
        (14803, "SlackIdentityError"): {
            "message": "Failed to retrieve Slack identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14804, "SlackAPIError"): {
            "message": "An error occurred while calling the Slack API.",
            "remediation": "Check the Slack status page and retry the request.",
        },
        (14805, "SlackRateLimitError"): {
            "message": "Rate limited by the Slack API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.SLACK_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Slack",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class SlackCredentialsError(SlackBaseException):
    """Credentials Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14800,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SlackAuthenticationError(SlackBaseException):
    """Authentication Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14801,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SlackSessionError(SlackBaseException):
    """Session Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14802,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SlackIdentityError(SlackBaseException):
    """Identity Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14803,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SlackAPIError(SlackBaseException):
    """A P I Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14804,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SlackRateLimitError(SlackBaseException):
    """Rate Limit Error for the Slack provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14805,
            file=file,
            original_exception=original_exception,
            message=message,
        )
