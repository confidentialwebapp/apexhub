from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.system.system_client import system_client


class vault_system_auto_unseal_configured(Check):
    """Vault clusters use auto-unseal or a quorum Shamir threshold

    With Shamir unsealing and a low threshold, one or two key holders can unseal Vault alone, removing the quorum control that protects the master key; and every restart requires humans to assemble, which pressures operators into storing shares together and defeating the split entirely. Auto-unseal moves the trust to a KMS key you can audit and revoke, and removes the temptation to hoard shares.
    """

    def execute(self) -> List[CheckReportVault]:
        min_threshold = self.audit_config.get("min_unseal_threshold", 3)
        min_shares = self.audit_config.get("min_unseal_shares", 5)

        findings = []
        system = system_client.system
        if system is None:
            return findings

        report = CheckReportVault(
            metadata=self.metadata(),
            resource=system,
            resource_name=system.address,
            resource_id=system.cluster_name or system.address,
        )

        seal_type = (system.seal_type or "shamir").lower()
        shares = system.key_shares or 0
        threshold = system.key_threshold or 0

        if seal_type != "shamir":
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {system.address} uses the {seal_type} auto-unseal seal "
                f"with a recovery threshold of {threshold} of {shares}."
            )
        elif threshold >= min_threshold and shares >= min_shares:
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {system.address} uses Shamir unsealing with a threshold of "
                f"{threshold} of {shares} shares."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {system.address} uses Shamir unsealing with a threshold of "
                f"{threshold} of {shares} shares (expected at least {min_threshold} of "
                f"{min_shares}, or an auto-unseal seal)."
            )

        findings.append(report)
        return findings
