from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.workspace.workspace_client import workspace_client


class slack_workspace_app_approval_required(Check):
    """Slack workspaces require admin approval before app installation

    A Slack app authorised by an ordinary member can hold scopes that read every message in every channel it is added to, and that access continues silently long after whoever installed it has forgotten about it. Malicious and abandoned apps in the directory are a recurring problem, and without approval gating your review happens after the data has already left.
    """

    def execute(self) -> List[CheckReportSlack]:
        ADMIN_ONLY = {"admins", "owners", "admins_and_owners", "admin"}

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

        restricted = workspace.who_can_manage_apps.lower() in ADMIN_ONLY

        if workspace.app_approval_required and restricted:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.name} requires app approval and restricts app "
                f"management to administrators."
            )
        elif workspace.app_approval_required:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} requires app approval but app management is "
                f"open to '{workspace.who_can_manage_apps or 'unknown'}'."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.name} does not require admin approval before app "
                f"installation."
            )

        findings.append(report)
        return findings
