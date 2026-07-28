# Exception codes from 15200 to 16199 are reserved for HCP Terraform.
from apexhub.exceptions.exceptions import ApexHubException


class TerraformCloudBaseException(ApexHubException):
    """Base exception for HCP Terraform provider errors."""

    TERRAFORMCLOUD_ERROR_CODES = {
        (15200, "TerraformCloudCredentialsError"): {
            "message": "HCP Terraform credentials not found or invalid.",
            "remediation": "Set TFC_TOKEN to an organization or team API token with read access to workspaces, variables and the audit trail. Set TFE_ADDRESS for a Terraform Enterprise installation.",
        },
        (15201, "TerraformCloudAuthenticationError"): {
            "message": "Authentication to the HCP Terraform API failed.",
            "remediation": "Verify the API token is valid, unexpired, and has the required read scopes.",
        },
        (15202, "TerraformCloudSessionError"): {
            "message": "Failed to create a HCP Terraform API session.",
            "remediation": "Check network connectivity and ensure https://app.terraform.io is reachable.",
        },
        (15203, "TerraformCloudIdentityError"): {
            "message": "Failed to retrieve HCP Terraform identity information.",
            "remediation": "Ensure the token has permission to read account and user information.",
        },
        (15204, "TerraformCloudAPIError"): {
            "message": "An error occurred while calling the HCP Terraform API.",
            "remediation": "Check the HCP Terraform status page and retry the request.",
        },
        (15205, "TerraformCloudRateLimitError"): {
            "message": "Rate limited by the HCP Terraform API.",
            "remediation": "Wait and retry; reduce scan concurrency if the limit is hit repeatedly.",
        },
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.TERRAFORMCLOUD_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="TerraformCloud",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )


class TerraformCloudCredentialsError(TerraformCloudBaseException):
    """Credentials Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15200,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class TerraformCloudAuthenticationError(TerraformCloudBaseException):
    """Authentication Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15201,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class TerraformCloudSessionError(TerraformCloudBaseException):
    """Session Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15202,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class TerraformCloudIdentityError(TerraformCloudBaseException):
    """Identity Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15203,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class TerraformCloudAPIError(TerraformCloudBaseException):
    """A P I Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15204,
            file=file,
            original_exception=original_exception,
            message=message,
        )

class TerraformCloudRateLimitError(TerraformCloudBaseException):
    """Rate Limit Error for the HCP Terraform provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=15205,
            file=file,
            original_exception=original_exception,
            message=message,
        )
