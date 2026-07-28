from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.user.user_client import user_client


class snowflake_user_no_stale_accounts(Check):
    """Snowflake has no enabled users that are dormant or never used

    A dormant but enabled account is a credential nobody is watching: its password is rarely rotated, its owner may have left, and unusual activity on it raises no expectation of being noticed. Because Snowflake roles are typically granted at onboarding and rarely revisited, stale accounts often retain access to data the person or system no longer has any business reason to read.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        from datetime import datetime, timedelta, timezone

        max_idle_days = self.audit_config.get("max_user_idle_days", 90)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)

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

            last_login = user.last_success_login
            if last_login is not None and last_login.tzinfo is None:
                last_login = last_login.replace(tzinfo=timezone.utc)

            if last_login is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.name} is enabled but has never logged in."
                )
            elif last_login < cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.name} is enabled but has not logged in since "
                    f"{last_login.date()} (threshold {max_idle_days} days)."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.name} last logged in on {last_login.date()}."
                )

            findings.append(report)

        return findings
