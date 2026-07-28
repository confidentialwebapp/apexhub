from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_audit_logs_accessible(Check):
    """Slack organizations have audit logs available for export

    Without audit log access there is no record of app installations, permission changes, file downloads or Slack Connect invitations. Those are exactly the events that distinguish an account compromise from normal use, so their absence means an intrusion is typically discovered only when its effects surface elsewhere.
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

        if workspace.audit_logs_readable:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} has audit logs available for export."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} has no readable audit log; administrative and "
                f"access events cannot be exported."
            )

        findings.append(report)
        return findings
