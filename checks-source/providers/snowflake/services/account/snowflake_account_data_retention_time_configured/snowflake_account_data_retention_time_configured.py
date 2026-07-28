from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.account.account_client import account_client


class snowflake_account_data_retention_time_configured(Check):
    """Snowflake accounts configure a minimum Time Travel retention period

    With retention at zero, a destructive statement — a mistaken `TRUNCATE`, or deliberate tampering by an attacker covering their tracks — is immediately unrecoverable, and there is no prior version to compare against when determining what was changed. Time Travel is often the only mechanism that can establish what a table contained before an incident.
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

        retention = account.data_retention_time_in_days
        minimum = account.min_data_retention_time_in_days

        if retention >= 1 and minimum >= 1:
            report.status = "PASS"
            report.status_extended = (
                f"Account {account.name} retains Time Travel data for {retention} day(s) "
                f"with a floor of {minimum} day(s)."
            )
        elif retention >= 1:
            report.status = "FAIL"
            report.status_extended = (
                f"Account {account.name} retains Time Travel data for {retention} day(s) "
                f"but sets no minimum, so object owners can reduce it to zero."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Account {account.name} has Time Travel retention set to {retention} days."
            )

        findings.append(report)
        return findings
