from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.networkpolicy.networkpolicy_client import networkpolicy_client


class snowflake_networkpolicy_no_broad_allowlist(Check):
    """Snowflake network policies do not allow the entire internet

    A network policy containing `0.0.0.0/0` satisfies configuration checks while enforcing nothing, which is worse than having no policy at all because it creates the appearance of a control. These entries are usually added temporarily to unblock a client and then never removed, leaving the account open to authentication attempts from anywhere.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        import ipaddress

        # A /8 or wider is treated as an over-broad grant for an allowlist.
        MAX_PREFIX_HOSTS = 2**24

        findings = []
        for policy in networkpolicy_client.policies.values():
            report = CheckReportSnowflake(
                metadata=self.metadata(),
                resource=policy,
                resource_name=policy.name,
                resource_id=policy.name,
            )

            if not policy.allowed_ip_list:
                report.status = "PASS"
                report.status_extended = (
                    f"Network policy {policy.name} defines no allowed IP list; access is "
                    f"governed by its blocked list."
                )
                findings.append(report)
                continue

            broad = []
            for entry in policy.allowed_ip_list:
                try:
                    network = ipaddress.ip_network(entry, strict=False)
                except ValueError:
                    continue
                if network.num_addresses >= MAX_PREFIX_HOSTS:
                    broad.append(entry)

            if broad:
                report.status = "FAIL"
                report.status_extended = (
                    f"Network policy {policy.name} allows over-broad range(s): "
                    f"{', '.join(broad)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Network policy {policy.name} allows {len(policy.allowed_ip_list)} "
                    f"scoped range(s)."
                )

            findings.append(report)

        return findings
