from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.user.user_client import user_client


class user_no_dormant_accounts(Check):
    """Okta has no active users that are dormant or have never signed in

    A dormant Okta account still federates into every application assigned to it, and because nobody uses it legitimately, nobody notices when someone else does. These accounts also tend to have older passwords and outdated factor enrolments, making them the easiest targets in the directory and the least likely compromise to be reported by the account's owner.
    """

    def execute(self) -> List[CheckReportOkta]:
        from datetime import datetime, timedelta, timezone

        max_idle_days = self.audit_config.get("max_user_idle_days", 90)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)
        ACTIVE_STATUSES = {"ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"}

        findings = []
        for user in user_client.users.values():
            if user.status not in ACTIVE_STATUSES:
                continue

            report = CheckReportOkta(
                metadata=self.metadata(),
                resource=user,
                resource_name=user.login,
                resource_id=user.id,
            )

            last_login = user.last_login
            if last_login is not None and last_login.tzinfo is None:
                last_login = last_login.replace(tzinfo=timezone.utc)

            if last_login is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} is active but has never signed in."
                )
            elif last_login < cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} has not signed in since {last_login.date()} "
                    f"(threshold {max_idle_days} days)."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.login} last signed in on {last_login.date()}."
                )

            findings.append(report)

        return findings
