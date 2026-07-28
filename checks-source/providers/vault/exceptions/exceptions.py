# Exception codes from 15100 to 16099 are reserved for HashiCorp Vault.
from apexhub.exceptions.exceptions import ApexHubException


class VaultBaseException(ApexHubException):
    """Base exception for HashiCorp Vault provider errors."""

    VAULT_ERROR_CODES = {
        (15100, "VaultCredentialsError"): {
            "message": "HashiCorp Vault credentials not found or invalid.",
            "remediation": "Set VAULT_ADDR and VAULT_TOKEN to a token whose policy grants read on sys/seal-status, sys/audit, sys/auth, sys/mounts and list on auth/token/accessors.",
        },
        (15101, "VaultAuthenticationError"): {
            "message": "Authentication to the HashiCorp Vault API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (15102, "VaultSessionError"): {
            "message": "Failed to create a HashiCorp Vault API session.",
            "remediation": "Check network connectivity and ensure https://vault.example.com:8200 is reachable.",
        },
        (15103, "VaultIdentityError"): {
            "message": "Failed to retrieve HashiCorp Vault identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (15104, "VaultAPIError"): {
            "message": "An error occurred while calling the HashiCorp Vault API.",
            "remediation": "Check the HashiCorp Vault status page and retry the request.",
        },
        (15105, "VaultRateLimitError"): {
            "message": "Rate limited by the HashiCorp Vault API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.VAULT_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="Vault",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class VaultCredentialsError(VaultBaseException):
    """Credentials Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15100,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class VaultAuthenticationError(VaultBaseException):
    """Authentication Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15101,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class VaultSessionError(VaultBaseException):
    """Session Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15102,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class VaultIdentityError(VaultBaseException):
    """Identity Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15103,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class VaultAPIError(VaultBaseException):
    """A P I Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15104,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class VaultRateLimitError(VaultBaseException):
    """Rate Limit Error for the HashiCorp Vault provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15105,
            file=file,
            original_exception=original_exception,
            message=message,
        )
