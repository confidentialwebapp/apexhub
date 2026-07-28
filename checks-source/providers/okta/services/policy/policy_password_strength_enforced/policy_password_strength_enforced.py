from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.policy.policy_client import policy_client


class policy_password_strength_enforced(Check):
    """Okta password policies enforce length, dictionary and lockout controls

    Okta's sign-in endpoint is internet-facing by design, so password policy directly determines how effective password spraying is against your whole directory at once. The common-password dictionary check matters most: spraying uses a small list of predictable passwords across many accounts precisely because lockout thresholds are per-account, and a dictionary check is what removes those passwords f
    """

    def execute(self) -> List[CheckReportOkta]:
        min_length_required = self.audit_config.get("min_password_length", 12)
        max_lockout_attempts = self.audit_config.get("max_invalid_login_attempts", 5)

        findings = []
        for policy in policy_client.policies.values():
            if policy.type != "PASSWORD" or policy.status != "ACTIVE":
                continue

            report = CheckReportOkta(
                metadata=self.metadata(),
                resource=policy,
                resource_name=policy.name,
                resource_id=policy.id,
            )

            issues = []
            if (policy.min_length or 0) < min_length_required:
                issues.append(
                    f"minimum length is {policy.min_length or 'unset'} "
                    f"(expected {min_length_required})"
                )
            if not policy.exclude_username:
                issues.append("the username is not excluded from passwords")
            if not policy.dictionary_check:
                issues.append("the common-password dictionary check is disabled")
            if policy.max_attempts is None or policy.max_attempts > max_lockout_attempts:
                issues.append(
                    f"lockout after {policy.max_attempts or 'unlimited'} attempts "
                    f"(expected {max_lockout_attempts} or fewer)"
                )

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Password policy {policy.name}: {'; '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Password policy {policy.name} requires {policy.min_length} "
                    f"characters with dictionary checking and lockout after "
                    f"{policy.max_attempts} attempts."
                )

            findings.append(report)

        return findings
