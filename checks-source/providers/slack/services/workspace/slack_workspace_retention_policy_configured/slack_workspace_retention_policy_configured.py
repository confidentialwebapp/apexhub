from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_retention_policy_configured(Check):
    """Slack workspaces configure message and file retention

    Slack's default is to keep messages and files forever, so the workspace accumulates years of pasted credentials, customer data and confidential discussion that no policy ever authorised retaining. A single account compromise then exposes the organisation's entire history rather than its recent activity, and the archive becomes discoverable in litigation regardless of business need.
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

        message_days = workspace.message_retention_days
        file_days = workspace.file_retention_days

        missing = []
        if not message_days:
            missing.append("messages")
        if not file_days:
            missing.append("files")

        if missing:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} retains {' and '.join(missing)} indefinitely."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} retains messages for {message_days} day(s) "
                f"and files for {file_days} day(s)."
            )

        findings.append(report)
        return findings
