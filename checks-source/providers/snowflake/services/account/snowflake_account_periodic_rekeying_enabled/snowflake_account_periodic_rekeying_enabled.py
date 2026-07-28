from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.account.account_client import account_client


class snowflake_account_periodic_rekeying_enabled(Check):
    """Snowflake accounts enable periodic data rekeying

    Without rekeying, the same data encryption key protects a table for its entire lifetime, so the window in which a single compromised key is useful is unbounded. Periodic rekeying limits the blast radius of key compromise and satisfies the cryptoperiod expectations that appear in most data protection standards.
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

        if account.periodic_data_rekeying:
            report.status = "PASS"
            report.status_extended = (
                f"Account {account.name} has periodic data rekeying enabled."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Account {account.name} does not have periodic data rekeying enabled."
            )

        findings.append(report)
        return findings
