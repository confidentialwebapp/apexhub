from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.account.account_client import account_client


class snowflake_account_network_policy_enforced(Check):
    """Snowflake accounts enforce an account-level network policy

    Without a network policy the account accepts authentication attempts from any address on the internet, so a credential harvested elsewhere is immediately usable with no further foothold required. Network scoping is the control that most reliably breaks that path, because it invalidates a stolen password even before authentication policy is considered.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        findings = []
        account = account_client.account_config
        if account is None:
            return findings

        report = CheckReportSnowflake(
            metadata=self.metadata(),
            resource=account,
            resource_name=account.name,
            resource_id=account.name,
        )

        if account.network_policy:
            report.status = "PASS"
            report.status_extended = (
                f"Account {account.name} enforces the network policy "
                f"{account.network_policy}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Account {account.name} does not enforce an account-level network policy."
            )

        findings.append(report)
        return findings
