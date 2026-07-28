from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.org.org_client import org_client


class salesforce_org_password_policy_strong(Check):
    """Salesforce orgs enforce a strong password policy

    Salesforce login endpoints are publicly reachable and continuously targeted by credential stuffing, so a weak minimum length or an unbounded retry count makes automated guessing practical. Because a successful login grants export capability over the customer record, the cost of a single guessed password is disproportionate to the effort required.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        min_length_required = self.audit_config.get("min_password_length", 12)
        max_lockout_attempts = self.audit_config.get("max_invalid_login_attempts", 5)

        findings = []
        org = org_client.org
        if org is None:
            return findings

        report = CheckReportSalesforce(
            metadata=self.metadata(),
            resource=org,
            resource_name=org.name,
            resource_id=org.id,
        )

        issues = []
        if (org.min_password_length or 0) < min_length_required:
            issues.append(
                f"minimum length is {org.min_password_length or 'unset'} "
                f"(expected {min_length_required})"
            )
        if not org.password_complexity or org.password_complexity.lower() in ("nore", "none"):
            issues.append("no character complexity requirement")
        if org.lockout_attempts is None or org.lockout_attempts > max_lockout_attempts:
            issues.append(
                f"lockout after {org.lockout_attempts or 'unlimited'} attempts "
                f"(expected {max_lockout_attempts} or fewer)"
            )

        if issues:
            report.status = "FAIL"
            report.status_extended = (
                f"Org {org.name} password policy is weak: {'; '.join(issues)}."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Org {org.name} enforces a password policy with a minimum length of "
                f"{org.min_password_length} and lockout after {org.lockout_attempts} "
                f"attempts."
            )

        findings.append(report)
        return findings
