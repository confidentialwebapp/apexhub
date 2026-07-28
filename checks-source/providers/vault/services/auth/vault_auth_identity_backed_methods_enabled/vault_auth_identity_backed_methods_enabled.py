from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.auth.auth_client import auth_client


class vault_auth_identity_backed_methods_enabled(Check):
    """Vault clusters authenticate through identity-backed methods

    With only the token auth method available, every consumer holds a static secret that was issued once and copied wherever it was needed. There is no upstream identity to revoke, no attestation of what the caller actually is, and offboarding a person or decommissioning a workload leaves working tokens behind. Identity-backed methods let Vault verify the caller against a source of truth on every logi
    """

    def execute(self) -> List[CheckReportVault]:
        IDENTITY_BACKED = {
            "oidc",
            "jwt",
            "kubernetes",
            "aws",
            "azure",
            "gcp",
            "ldap",
            "cert",
            "okta",
            "github",
        }

        findings = []
        report = CheckReportVault(
            metadata=self.metadata(),
            resource=list(auth_client.methods.values()),
            resource_name=self._base_url,
            resource_id=self._base_url,
        )

        enabled = {
            method.type for method in auth_client.methods.values() if method.type
        }
        identity_methods = enabled & IDENTITY_BACKED

        if identity_methods:
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {self._base_url} enables identity-backed auth method(s): "
                f"{', '.join(sorted(identity_methods))}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {self._base_url} enables no identity-backed auth method; "
                f"only static tokens are available."
            )

        findings.append(report)
        return findings
