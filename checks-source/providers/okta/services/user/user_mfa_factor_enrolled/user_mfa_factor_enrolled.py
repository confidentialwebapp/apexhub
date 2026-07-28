from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.user.user_client import user_client


class user_mfa_factor_enrolled(Check):
    """Okta users have an active multi-factor authentication factor enrolled

    Okta is the front door to every application it federates, so a user without a second factor is a single password away from every downstream system at once. Where SMS is the only factor, SIM swap and interception defeat it — and because attackers target the identity provider specifically to reach everything behind it, weak factors here have the widest possible blast radius.
    """

    def execute(self) -> List[CheckReportOkta]:
        PHISHING_RESISTANT = {"webauthn", "u2f", "token:hardware", "signed_nonce"}
        WEAK_FACTORS = {"sms", "call"}
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

            factors = {factor.strip().lower() for factor in user.factors if factor}

            if not factors:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} has no active multi-factor authentication factor "
                    f"enrolled."
                )
            elif factors <= WEAK_FACTORS:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.login} has only weak factor(s) enrolled: "
                    f"{', '.join(sorted(factors))}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.login} has {len(factors)} active factor(s) enrolled: "
                    f"{', '.join(sorted(factors))}."
                )
                if not factors & PHISHING_RESISTANT:
                    report.status_extended += " No phishing-resistant factor is enrolled."

            findings.append(report)

        return findings
