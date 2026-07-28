from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.workspace.workspace_client import workspace_client


class terraformcloud_workspace_auto_apply_disabled(Check):
    """HCP Terraform workspaces require manual apply approval

    Auto-apply removes the last review point between a merged configuration change and live infrastructure, so a malicious or mistaken commit reaches production without anyone reading the plan. Terraform plans also surface destructive actions — resource replacement and deletion — that a reviewer would catch; auto-apply executes them silently.
    """

    def execute(self) -> List[CheckReportTerraformCloud]:
        findings = []
        for workspace in workspace_client.workspaces.values():
            report = CheckReportTerraformCloud(
                metadata=self.metadata(),
                resource=workspace,
                resource_name=f"{workspace.organization}/{workspace.name}",
                resource_id=workspace.id,
            )

            if workspace.auto_apply:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name} applies plans automatically without "
                    f"manual approval."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.name} requires manual approval before applying."
                )

            findings.append(report)

        return findings
