from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.audit.audit_client import audit_client


class vault_audit_device_enabled(Check):
    """Vault clusters have at least one audit device enabled

    With no audit device, Vault keeps no record of which secrets were read or by whom, so a compromised token can drain the entire store leaving nothing to investigate. This is the single most consequential logging gap in a secrets platform: without it, an incident response cannot determine which credentials need rotating, forcing a rotation of everything.
    """

    def execute(self) -> List[CheckReportVault]:
        findings = []

        if audit_client.devices:
            for device in audit_client.devices.values():
                report = CheckReportVault(
                    metadata=self.metadata(),
                    resource=device,
                    resource_name=device.path,
                    resource_id=device.path,
                )

                if device.log_raw:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Audit device {device.path} ({device.type}) is enabled but logs "
                        f"raw request and response data, writing secret values in cleartext."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Audit device {device.path} ({device.type}) is enabled with "
                        f"sensitive values hashed."
                    )

                findings.append(report)
        else:
            report = CheckReportVault(
                metadata=self.metadata(),
                resource={},
                resource_name=self._base_url,
                resource_id=self._base_url,
            )
            report.status = "FAIL"
            report.status_extended = (
                f"Vault cluster {self._base_url} has no audit device enabled."
            )
            findings.append(report)

        return findings
