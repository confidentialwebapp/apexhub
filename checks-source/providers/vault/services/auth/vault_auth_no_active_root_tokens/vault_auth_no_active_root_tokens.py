from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.auth.auth_client import auth_client


class vault_auth_no_active_root_tokens(Check):
    """Vault clusters have no outstanding root tokens

    A root token is unrestricted and, unless explicitly created with a TTL, never expires. Anyone holding one can read every secret, disable the audit devices that would record them doing so, and create further tokens for persistence. Root tokens generated during initial setup and never revoked are among the most common serious findings in a Vault deployment.
    """

    def execute(self) -> List[CheckReportVault]:
        findings = []
        report = CheckReportVault(
            metadata=self.metadata(),
            resource=auth_client.root_token_accessors,
            resource_name=self._base_url,
            resource_id=self._base_url,
        )

        count = len(auth_client.root_token_accessors)

        if count == 0:
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {self._base_url} has no outstanding root tokens."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {self._base_url} has {count} outstanding root token(s), "
                f"which bypass all policy enforcement."
            )

        findings.append(report)
        return findings
