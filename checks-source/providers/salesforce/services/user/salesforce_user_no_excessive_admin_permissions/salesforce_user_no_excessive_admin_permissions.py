from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.user.user_client import user_client


class salesforce_user_no_excessive_admin_permissions(Check):
    """Salesforce users do not hold excessive administrative permissions

    Modify All Data overrides every sharing rule, field permission and record ownership control in the org, so a single compromised account with it holds the entire data set regardless of the sharing model. Author Apex additionally allows deploying code that runs in system context, giving an attacker a persistent, auditable-looking mechanism to exfiltrate data on a schedule.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        findings = []
        for user in user_client.users.values():
            if not user.is_active:
                continue
            # Integration users are assessed separately; this check targets human logins.
            if user.user_type not in ("Standard", "PowerPartner", "CsnOnly"):
                continue

            report = CheckReportSalesforce(
                metadata=self.metadata(),
                resource=user,
                resource_name=user.username,
                resource_id=user.id,
            )

            granted = []
            if user.modify_all_data:
                granted.append("Modify All Data")
            if user.manage_users:
                granted.append("Manage Users")
            if user.author_apex:
                granted.append("Author Apex")

            if granted:
                report.status = "FAIL"
                report.status_extended = (
                    f"User {user.username} (profile {user.profile_name}) holds "
                    f"{', '.join(granted)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"User {user.username} (profile {user.profile_name}) holds no "
                    f"excessive administrative permissions."
                )

            findings.append(report)

        return findings
