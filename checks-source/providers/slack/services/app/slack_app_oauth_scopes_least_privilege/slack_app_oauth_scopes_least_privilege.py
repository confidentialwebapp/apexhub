from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.app.app_client import app_client


class slack_app_oauth_scopes_least_privilege(Check):
    """Slack apps do not hold workspace-wide message read scopes

    A `history` scope lets an app read the complete message archive of every conversation it can see, not just messages that mention it, so one compromised vendor becomes a full export of your internal discussion. `admin.*` scopes go further still, allowing the app to change workspace settings and manage other apps — a self-sustaining foothold.
    """

    def execute(self) -> List[CheckReportSlack]:
        BROAD_SCOPES = {
            "channels:history",
            "groups:history",
            "im:history",
            "mpim:history",
            "files:read",
            "search:read",
            "users:read.email",
        }

        findings = []
        for app in app_client.apps.values():
            report = CheckReportSlack(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name or app.id,
                resource_id=app.id,
            )

            scopes = {scope.strip().lower() for scope in app.scopes if scope}
            admin_scopes = {scope for scope in scopes if scope.startswith("admin")}
            broad = (scopes & BROAD_SCOPES) | admin_scopes

            if broad:
                report.status = "FAIL"
                report.status_extended = (
                    f"App {app.name or app.id} holds broad scope(s): "
                    f"{', '.join(sorted(broad))}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"App {app.name or app.id} holds {len(scopes)} scoped permission(s) "
                    f"with no workspace-wide message or admin access."
                )

            findings.append(report)

        return findings
