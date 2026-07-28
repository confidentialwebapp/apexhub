from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.org.org_client import org_client


class salesforce_org_session_settings_hardened(Check):
    """Salesforce orgs harden session settings

    A Salesforce session ID that is not bound to its originating address can be replayed from anywhere once stolen through a malicious browser extension, an XSS flaw in a Visualforce page, or a phishing proxy. Long timeouts widen that replay window considerably, and because sessions survive password changes, revocation during an incident is slower than administrators expect.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        max_timeout_minutes = self.audit_config.get("max_session_timeout_minutes", 120)

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
        if not org.lock_sessions_to_ip:
            issues.append("sessions are not locked to their originating IP address")
        timeout = org.session_timeout_minutes
        if timeout is None or timeout > max_timeout_minutes:
            issues.append(
                f"session timeout is {timeout or 'unset'} minutes "
                f"(expected {max_timeout_minutes} or fewer)"
            )

        if issues:
            report.status = "FAIL"
            report.status_extended = f"Org {org.name} session settings: {'; '.join(issues)}."
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Org {org.name} locks sessions to their originating IP address with a "
                f"{timeout} minute timeout."
            )

        findings.append(report)
        return findings
