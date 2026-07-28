from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.auth.auth_client import auth_client


class vault_auth_token_ttl_bounded(Check):
    """Vault auth methods bound token lifetime

    A token with an unbounded maximum TTL can be renewed forever, so a credential stolen from a log, a container environment or a developer machine stays valid until someone notices and revokes it explicitly. Bounded lifetimes convert theft from a permanent compromise into a time-limited one, and force the legitimate consumer to re-authenticate through the identity source you actually control.
    """

    def execute(self) -> List[CheckReportVault]:
        max_allowed_seconds = self.audit_config.get("max_token_ttl_seconds", 2764800)

        findings = []
        for method in auth_client.methods.values():
            report = CheckReportVault(
                metadata=self.metadata(),
                resource=method,
                resource_name=method.path,
                resource_id=method.path,
            )

            max_ttl = method.max_lease_ttl

            # 0 means "inherit the system max", which is itself unbounded by default.
            if max_ttl is None or max_ttl == 0:
                report.status = "FAIL"
                report.status_extended = (
                    f"Auth method {method.path} ({method.type}) does not set a maximum "
                    f"lease TTL, so tokens can be renewed indefinitely."
                )
            elif max_ttl > max_allowed_seconds:
                report.status = "FAIL"
                report.status_extended = (
                    f"Auth method {method.path} ({method.type}) sets a maximum lease TTL "
                    f"of {max_ttl} seconds, above the {max_allowed_seconds} second bound."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Auth method {method.path} ({method.type}) bounds token lifetime at "
                    f"{max_ttl} seconds."
                )

            findings.append(report)

        return findings
