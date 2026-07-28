# Exception codes from 14000 to 14999 are reserved for GitLab.
from apexhub.exceptions.exceptions import ApexHubException


class GitLabBaseException(ApexHubException):
    """Base exception for GitLab provider errors."""

    GITLAB_ERROR_CODES = {
        (14000, "GitLabCredentialsError"): {
            "message": "GitLab credentials not found or invalid.",
            "remediation": "Set GITLAB_TOKEN to a personal, group or project access token with the read_api scope. Create one under User settings > Access tokens.",
        },
        (14001, "GitLabAuthenticationError"): {
            "message": "Authentication to the GitLab API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14002, "GitLabSessionError"): {
            "message": "Failed to create a GitLab API session.",
            "remediation": "Check network connectivity and ensure https://gitlab.com/api/v4 is reachable.",
        },
        (14003, "GitLabIdentityError"): {
            "message": "Failed to retrieve GitLab identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14004, "GitLabAPIError"): {
            "message": "An error occurred while calling the GitLab API.",
            "remediation": "Check the GitLab status page and retry the request.",
        },
        (14005, "GitLabRateLimitError"): {
            "message": "Rate limited by the GitLab API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.GITLAB_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="GitLab",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class GitLabCredentialsError(GitLabBaseException):
    """Credentials Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14000,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class GitLabAuthenticationError(GitLabBaseException):
    """Authentication Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14001,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class GitLabSessionError(GitLabBaseException):
    """Session Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14002,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class GitLabIdentityError(GitLabBaseException):
    """Identity Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14003,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class GitLabAPIError(GitLabBaseException):
    """A P I Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14004,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class GitLabRateLimitError(GitLabBaseException):
    """Rate Limit Error for the GitLab provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14005,
            file=file,
            original_exception=original_exception,
            message=message,
        )
