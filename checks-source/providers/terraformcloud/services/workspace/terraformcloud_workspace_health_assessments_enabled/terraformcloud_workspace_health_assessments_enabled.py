from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.workspace.workspace_client import workspace_client


class terraformcloud_workspace_health_assessments_enabled(Check):
    """HCP Terraform workspaces enable health assessments and drift detection

    Without drift detection, an out-of-band change to production goes unnoticed until the next apply, which then silently reverts or compounds it. From a security standpoint drift is often the signal itself: a security group opened by hand, a policy loosened during an incident, or an attacker's modification all appear as drift, and detecting them at the next scheduled assessment is far faster than at 
    """

    def execute(self) -> List[CheckReportTerraformCloud]:
        findings = []
        for workspace in workspace_client.workspaces.values():
            # Assessments require remote execution; local workspaces cannot run them.
            if workspace.execution_mode == "local":
                continue

            report = CheckReportTerraformCloud(
                metadata=self.metadata(),
                resource=workspace,
                resource_name=f"{workspace.organization}/{workspace.name}",
                resource_id=workspace.id,
            )

            if workspace.assessments_enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.name} has health assessments enabled."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name} has health assessments disabled, so drift "
                    f"is not detected between runs."
                )

            findings.append(report)

        return findings
