from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.user.user_client import user_client


class user_password_rotated(Check):
    """Okta user passwords have been changed within the rotation window

    A password unchanged for years is one that has had the maximum possible exposure to credential breaches elsewhere, since reuse is common and breach corpora accumulate over time. While forced frequent rotation is no longer recommended practice, an unchanged credential of this age combined with weak or absent MFA is a meaningful indicator of an account worth attention.
    """

    def execute(self) -> List[CheckReportOkta]:
        from datetime import datetime, timedelta, timezone

        max_age_days = self.audit_config.get("max_password_age_days", 365)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
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

            changed = user.password_changed
            if changed is not None and changed.tzinfo is None:
                changed = changed.replace(tzinfo=timezone.utc)

            if changed is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} has no recorded password change."
                )
            elif changed < cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} last changed their password on {changed.date()} "
                    f"(threshold {max_age_days} days)."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.login} changed their password on {changed.date()}."
                )

            findings.append(report)

        return findings
