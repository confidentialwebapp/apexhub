from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.user.user_client import user_client


class snowflake_user_default_role_not_privileged(Check):
    """Snowflake users do not default to ACCOUNTADMIN or SECURITYADMIN

    When a session starts as ACCOUNTADMIN, every routine query, notebook and BI connection runs with full account privileges, and any SQL injection or compromised client immediately inherits them. Snowflake's own guidance is that ACCOUNTADMIN should be assumed explicitly for administrative work only, so a privileged default role removes the last barrier between an ordinary mistake and account-wide imp
    """

    def execute(self) -> List[CheckReportSnowflake]:
        PRIVILEGED_ROLES = {"ACCOUNTADMIN", "SECURITYADMIN", "ORGADMIN"}

        findings = []
        for user in user_client.users.values():
            if user.disabled:
                continue

            report = CheckReportSnowflake(
                metadata=self.metadata(),
                resource=user,
                resource_name=user.name,
                resource_id=user.name,
            )

            default_role = (user.default_role or "").upper()

            if default_role in PRIVILEGED_ROLES:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.name} has the privileged default role {default_role}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.name} has the default role "
                    f"{default_role or '(none)'}, which is not privileged."
                )

            findings.append(report)

        return findings
