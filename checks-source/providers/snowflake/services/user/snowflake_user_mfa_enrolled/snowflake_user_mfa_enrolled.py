from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.user.user_client import user_client


class snowflake_user_mfa_enrolled(Check):
    """Snowflake human users are enrolled in multi-factor authentication

    Snowflake accounts hold consolidated analytical copies of an organisation's most sensitive data, and a password-only login is directly usable from anywhere on the internet. Large-scale intrusions into Snowflake tenants have been driven almost entirely by credential reuse against accounts without MFA, using passwords harvested from unrelated infostealer infections rather than any flaw in the platfo
    """

    def execute(self) -> List[CheckReportSnowflake]:
        findings = []
        for user in user_client.users.values():
            if user.disabled:
                continue
            # Service users authenticate by key pair and hold no phishable password.
            if not user.has_password:
                continue

            report = CheckReportSnowflake(
                metadata=self.metadata(),
                resource=user,
                resource_name=user.name,
                resource_id=user.name,
            )

            if user.mfa_enrolled:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.name} is enrolled in multi-factor authentication."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.name} can authenticate with a password but is not "
                    f"enrolled in multi-factor authentication."
                )

            findings.append(report)

        return findings
