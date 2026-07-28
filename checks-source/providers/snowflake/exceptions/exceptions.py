# Exception codes from 14300 to 15299 are reserved for Snowflake.
from apexhub.exceptions.exceptions import ApexHubException


class SnowflakeBaseException(ApexHubException):
    """Base exception for Snowflake provider errors."""

    SNOWFLAKE_ERROR_CODES = {
        (14300, "SnowflakeCredentialsError"): {
            "message": "Snowflake credentials not found or invalid.",
            "remediation": "Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER and either SNOWFLAKE_PRIVATE_KEY (recommended) or SNOWFLAKE_PASSWORD. The scan role needs IMPORTED PRIVILEGES on the SNOWFLAKE database to read ACCOUNT_USAGE.",
        },
        (14301, "SnowflakeAuthenticationError"): {
            "message": "Authentication to the Snowflake API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (14302, "SnowflakeSessionError"): {
            "message": "Failed to create a Snowflake API session.",
            "remediation": "Check network connectivity and ensure https://<account>.snowflakecomputing.com is reachable.",
        },
        (14303, "SnowflakeIdentityError"): {
            "message": "Failed to retrieve Snowflake identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (14304, "SnowflakeAPIError"): {
            "message": "An error occurred while calling the Snowflake API.",
            "remediation": "Check the Snowflake status page and retry the request.",
        },
        (14305, "SnowflakeRateLimitError"): {
            "message": "Rate limited by the Snowflake API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.SNOWFLAKE_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Snowflake",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class SnowflakeCredentialsError(SnowflakeBaseException):
    """Credentials Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14300,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SnowflakeAuthenticationError(SnowflakeBaseException):
    """Authentication Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14301,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SnowflakeSessionError(SnowflakeBaseException):
    """Session Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14302,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SnowflakeIdentityError(SnowflakeBaseException):
    """Identity Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14303,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SnowflakeAPIError(SnowflakeBaseException):
    """A P I Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14304,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class SnowflakeRateLimitError(SnowflakeBaseException):
    """Rate Limit Error for the Snowflake provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=14305,
            file=file,
            original_exception=original_exception,
            message=message,
        )
