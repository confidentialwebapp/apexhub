from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_sso_required(Check):
    """Slack workspaces require SSO for member sign-in

    Slack accumulates an organisation's most sensitive informal record: credentials pasted into DMs, incident detail, contract discussion and internal architecture. Without enforced SSO there is no conditional access and no central session revocation, so a leaver or a phished account retains a searchable archive of all of it until someone manually intervenes.
    """

    def execute(self) -> List[CheckReportSlack]:
        findings = []
        workspace = workspace_client.workspace
        if workspace is None:
            return findings

        report = CheckReportSlack(
            metadata=self.metadata(),
            resource=workspace,
            resource_name=workspace.name or workspace.id,
            resource_id=workspace.id,
        )

        if workspace.sso_required:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} requires SSO for member sign-in."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} does not require SSO for member sign-in."
            )

        findings.append(report)
        return findings
