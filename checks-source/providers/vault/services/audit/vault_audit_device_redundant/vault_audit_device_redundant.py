from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.audit.audit_client import audit_client


class vault_audit_device_redundant(Check):
    """Vault clusters have more than one audit device enabled

    A single audit device is both a logging and an availability dependency: if its disk fills or the syslog target becomes unreachable, Vault stops answering requests and every application depending on it for credentials fails. Operators under that pressure frequently disable auditing to restore service, which removes the record precisely when it matters most.
    """

    def execute(self) -> List[CheckReportVault]:
        findings = []
        report = CheckReportVault(
            metadata=self.metadata(),
            resource=list(audit_client.devices.values()),
            resource_name=self._base_url,
            resource_id=self._base_url,
        )

        count = len(audit_client.devices)
        socket_only = count > 0 and all(
            device.type == "socket" for device in audit_client.devices.values()
        )

        if count >= 2 and not socket_only:
            report.status = "PASS"
            report.status_extended = (
                f"Vault cluster {self._base_url} has {count} audit devices enabled: "
                f"{', '.join(sorted(audit_client.devices))}."
            )
        elif socket_only:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {self._base_url} uses only socket audit device(s); a "
                f"network partition would block all requests."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {self._base_url} has {count} audit device(s); a single "
                f"failing sink would block all requests."
            )

        findings.append(report)
        return findings
