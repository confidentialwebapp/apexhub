# Exception codes from 14200 to 15199 are reserved for Jenkins.
from apexhub.exceptions.exceptions import ApexHubException


class JenkinsBaseException(ApexHubException):
    """Base exception for Jenkins provider errors."""

    JENKINS_ERROR_CODES = {
        (14200, "JenkinsCredentialsError"): {
            "message": "Jenkins credentials not found or invalid.",
            "remediation": "Set JENKINS_URL to the controller URL and JENKINS_TOKEN to a base64-encoded 'user:api-token' pair. Generate the API token under the user's Configure page; Overall/Administer is required to read the security configuration.",
        },
        (14201, "JenkinsAuthenticationError"): {
            "message": "Authentication to the Jenkins API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14202, "JenkinsSessionError"): {
            "message": "Failed to create a Jenkins API session.",
            "remediation": "Check network connectivity and ensure https://jenkins.example.com is reachable.",
        },
        (14203, "JenkinsIdentityError"): {
            "message": "Failed to retrieve Jenkins identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14204, "JenkinsAPIError"): {
            "message": "An error occurred while calling the Jenkins API.",
            "remediation": "Check the Jenkins status page and retry the request.",
        },
        (14205, "JenkinsRateLimitError"): {
            "message": "Rate limited by the Jenkins API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.JENKINS_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Jenkins",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class JenkinsCredentialsError(JenkinsBaseException):
    """Credentials Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14200,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class JenkinsAuthenticationError(JenkinsBaseException):
    """Authentication Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14201,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class JenkinsSessionError(JenkinsBaseException):
    """Session Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14202,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class JenkinsIdentityError(JenkinsBaseException):
    """Identity Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14203,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class JenkinsAPIError(JenkinsBaseException):
    """A P I Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14204,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class JenkinsRateLimitError(JenkinsBaseException):
    """Rate Limit Error for the Jenkins provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14205,
            file=file,
            original_exception=original_exception,
            message=message,
        )
