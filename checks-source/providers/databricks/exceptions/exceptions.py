# Exception codes from 14400 to 15399 are reserved for Databricks.
from apexhub.exceptions.exceptions import ApexHubException


class DatabricksBaseException(ApexHubException):
    """Base exception for Databricks provider errors."""

    DATABRICKS_ERROR_CODES = {
        (14400, "DatabricksCredentialsError"): {
            "message": "Databricks credentials not found or invalid.",
            "remediation": "Set DATABRICKS_HOST to the workspace URL and DATABRICKS_TOKEN to a service principal OAuth token. Account-level checks additionally need DATABRICKS_ACCOUNT_ID and account admin scope.",
        },
        (14401, "DatabricksAuthenticationError"): {
            "message": "Authentication to the Databricks API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14402, "DatabricksSessionError"): {
            "message": "Failed to create a Databricks API session.",
            "remediation": "Check network connectivity and ensure https://<workspace>.cloud.databricks.com is reachable.",
        },
        (14403, "DatabricksIdentityError"): {
            "message": "Failed to retrieve Databricks identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14404, "DatabricksAPIError"): {
            "message": "An error occurred while calling the Databricks API.",
            "remediation": "Check the Databricks status page and retry the request.",
        },
        (14405, "DatabricksRateLimitError"): {
            "message": "Rate limited by the Databricks API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.DATABRICKS_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Databricks",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class DatabricksCredentialsError(DatabricksBaseException):
    """Credentials Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14400,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class DatabricksAuthenticationError(DatabricksBaseException):
    """Authentication Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14401,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class DatabricksSessionError(DatabricksBaseException):
    """Session Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14402,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class DatabricksIdentityError(DatabricksBaseException):
    """Identity Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14403,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class DatabricksAPIError(DatabricksBaseException):
    """A P I Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14404,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class DatabricksRateLimitError(DatabricksBaseException):
    """Rate Limit Error for the Databricks provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14405,
            file=file,
            original_exception=original_exception,
            message=message,
        )
