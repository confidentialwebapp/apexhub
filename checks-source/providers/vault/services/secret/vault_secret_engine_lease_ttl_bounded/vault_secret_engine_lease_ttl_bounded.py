from typing import List

from apexhub.lib.check.models import Check, CheckReportVault
from apexhub.providers.vault.services.secret.secret_client import secret_client


class vault_secret_engine_lease_ttl_bounded(Check):
    """Vault dynamic secret engines bound credential lease lifetime

    The value of a dynamic secret engine is that credentials are short-lived and revoked automatically; without a bounded maximum lease TTL that property is lost and the engine simply becomes a generator of long-lived credentials scattered across your estate. Worse, each is a real database user or cloud principal, so an unbounded lease leaves durable access that no rotation of the Vault token will rev
    """

    def execute(self) -> List[CheckReportVault]:
        DYNAMIC_ENGINES = {
            "database",
            "aws",
            "azure",
            "gcp",
            "pki",
            "ssh",
            "consul",
            "nomad",
            "rabbitmq",
        }

        max_allowed_seconds = self.audit_config.get("max_lease_ttl_seconds", 604800)

        findings = []
        for mount in secret_client.mounts.values():
            if mount.type not in DYNAMIC_ENGINES:
                continue

            report = CheckReportVault(
                metadata=self.metadata(),
                resource=mount,
                resource_name=mount.path,
                resource_id=mount.path,
            )

            max_ttl = mount.max_lease_ttl

            if max_ttl is None or max_ttl == 0:
                report.status = "FAIL"
                report.status_extended = (
                    f"Secret engine {mount.path} ({mount.type}) does not set a maximum "
                    f"lease TTL for the credentials it issues."
                )
            elif max_ttl > max_allowed_seconds:
                report.status = "FAIL"
                report.status_extended = (
                    f"Secret engine {mount.path} ({mount.type}) issues credentials with a "
                    f"maximum lease of {max_ttl} seconds, above the "
                    f"{max_allowed_seconds} second bound."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Secret engine {mount.path} ({mount.type}) bounds credential leases "
                    f"at {max_ttl} seconds."
                )

            findings.append(report)

        return findings
