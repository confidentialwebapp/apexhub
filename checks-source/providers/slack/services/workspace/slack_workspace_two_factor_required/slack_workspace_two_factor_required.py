from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_two_factor_required(Check):
    """Slack workspaces require two-factor authentication

    Where SSO is not required, a Slack password is the only barrier to a fully searchable message history, including any credential a colleague pasted into a channel. Slack account takeover is also a favoured route for internal phishing, because a message from a trusted colleague's real account bypasses the scepticism an external email would attract.
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

        # SSO delegates the factor policy to the identity provider.
        if workspace.two_factor_required or workspace.sso_required:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} requires two-factor authentication"
                f"{' through the federated identity provider' if not workspace.two_factor_required else ''}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} does not require two-factor authentication."
            )

        findings.append(report)
        return findings
