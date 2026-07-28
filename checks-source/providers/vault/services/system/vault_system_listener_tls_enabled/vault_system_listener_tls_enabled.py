from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.system.system_client import system_client


class vault_system_listener_tls_enabled(Check):
    """Vault listeners require TLS

    Vault tokens and secret values travel in the request and response bodies, so a listener without TLS publishes every credential the cluster serves to anyone on the network path. Because a captured token is immediately replayable, one intercepted request is enough to reach every secret that token's policy allows — the entire purpose of the system defeated at the transport layer.
    """

    def execute(self) -> List[CheckReportVault]:
        findings = []
        system = system_client.system
        if system is None:
            return findings

        if system.listeners:
            for listener in system.listeners:
                report = CheckReportVault(
                    metadata=self.metadata(),
                    resource=listener,
                    resource_name=listener.address or listener.type,
                    resource_id=f"{listener.type}:{listener.address}",
                )

                if listener.tls_disable:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Vault listener {listener.type} on {listener.address} has TLS "
                        f"disabled."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Vault listener {listener.type} on {listener.address} requires TLS."
                    )

                findings.append(report)
        else:
            # The sanitized config endpoint was not readable; fall back to the address.
            report = CheckReportVault(
                metadata=self.metadata(),
                resource=system,
                resource_name=system.address,
                resource_id=system.address,
            )
            if system.address.startswith("https://"):
                report.status = "PASS"
                report.status_extended = (
                    f"Vault cluster is reached over HTTPS at {system.address}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Vault cluster is reached over plaintext HTTP at {system.address}."
                )
            findings.append(report)

        return findings
