from typing import List

from apexhub.lib.check.models import Check, CheckReportSalesforce
from apexhub.providers.salesforce.services.connectedapp.connectedapp_client import connectedapp_client


class salesforce_connectedapp_oauth_scopes_least_privilege(Check):
    """Salesforce connected apps request least-privilege OAuth scopes

    The `full` scope grants a third-party application everything the authorising user can do, including exporting the entire customer record, and the accompanying refresh token makes that access indefinite and survivable across password resets. Connected apps are also a favoured persistence mechanism: an attacker who authorises one retains access long after the compromised session is closed.
    """

    def execute(self) -> List[CheckReportSalesforce]:
        BROAD_SCOPES = {"full", "refresh_token", "offline_access", "web", "api"}

        findings = []
        for app in connectedapp_client.apps.values():
            report = CheckReportSalesforce(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name,
                resource_id=app.id,
            )

            scopes = {scope.strip().lower() for scope in app.scopes}
            issues = []

            if "full" in scopes:
                issues.append("requests the 'full' scope")
            elif scopes & BROAD_SCOPES and not app.admin_approved_users_only:
                issues.append(
                    f"requests {', '.join(sorted(scopes & BROAD_SCOPES))} without "
                    f"restricting authorisation to admin-approved users"
                )

            insecure_callbacks = [
                url
                for url in app.callback_urls
                if not url.startswith("https://") or "*" in url
            ]
            if insecure_callbacks:
                issues.append(
                    f"has non-exact or insecure callback URL(s): "
                    f"{', '.join(insecure_callbacks)}"
                )

            if issues:
                report.status = "FAIL"
                report.status_extended = f"Connected app {app.name} {'; '.join(issues)}."
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Connected app {app.name} requests scoped OAuth permissions with "
                    f"exact HTTPS callback URLs."
                )

            findings.append(report)

        return findings
