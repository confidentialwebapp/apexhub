from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.user.user_client import user_client


class salesforce_user_mfa_registered(Check):
    """Salesforce users have a multi-factor verification method registered

    Salesforce orgs hold the complete customer record: contacts, pipeline, contracts and often payment detail. A password-only login is directly usable from anywhere, and credential phishing against Salesforce users is a standing, well-tooled attack because the export capability built into the platform turns one session into a full data set.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        findings = []
        for user in user_client.users.values():
            if not user.is_active:
                continue

            report = CheckReportSalesforce(
                metadata=self.metadata(),
                resource=user,
                resource_name=user.username,
                resource_id=user.id,
            )

            if user.mfa_factors:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.username} has {len(user.mfa_factors)} verification "
                    f"method(s) registered: {', '.join(sorted(set(user.mfa_factors)))}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.username} has no multi-factor verification method "
                    f"registered."
                )

            findings.append(report)

        return findings
