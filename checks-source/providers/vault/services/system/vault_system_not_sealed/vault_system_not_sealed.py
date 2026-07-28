from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.system.system_client import system_client


class vault_system_not_sealed(Check):
    """Vault clusters are unsealed and serving requests

    A sealed Vault is a total outage for every application that depends on it for database credentials, certificates and API keys, and the recovery path requires assembling unseal key holders under time pressure. Teams routinely respond by caching secrets locally or falling back to static credentials, which quietly undoes the controls Vault was deployed to provide.
    """

    def execute(self) -> List[CheckReportVault]:
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

        if system.sealed:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {system.address} is sealed and is not serving requests."
            )
        elif not system.ha_enabled:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {system.address} is unsealed but high availability is not "
                f"enabled, so a single node restart interrupts every consumer."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {system.address} is unsealed and running in high "
                f"availability mode."
            )

        findings.append(report)
        return findings
