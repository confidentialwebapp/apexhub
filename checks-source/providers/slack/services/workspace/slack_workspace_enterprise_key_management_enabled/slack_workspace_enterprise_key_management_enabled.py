from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_enterprise_key_management_enabled(Check):
    """Slack Enterprise Grid organizations use enterprise key management

    With platform-managed keys only, you cannot independently revoke access to your message history — containment during a suspected platform incident depends entirely on the provider acting. Customer-managed keys also let you revoke access at channel or workspace granularity and give you the key-usage audit trail that regulated programmes expect.
    """

    def execute(self) -> List[CheckReportSlack]:
        findings = []
        workspace = workspace_client.workspace
        if workspace is None:
            return findings

        # EKM is an Enterprise Grid capability; standalone workspaces cannot enable it.
        if not workspace.enterprise_id:
            return findings

        report = CheckReportSlack(
            metadata=self.metadata(),
            resource=workspace,
            resource_name=workspace.name or workspace.id,
            resource_id=workspace.id,
        )

        if workspace.enterprise_key_management:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} uses enterprise key management."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} is on Enterprise Grid but does not use "
                f"enterprise key management."
            )

        findings.append(report)
        return findings
