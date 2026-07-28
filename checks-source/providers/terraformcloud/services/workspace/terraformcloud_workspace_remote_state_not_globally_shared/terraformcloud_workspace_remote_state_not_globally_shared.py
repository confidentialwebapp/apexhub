from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.workspace.workspace_client import workspace_client


class terraformcloud_workspace_remote_state_not_globally_shared(Check):
    """HCP Terraform workspaces do not share remote state organization-wide

    Terraform state contains the full attribute set of every resource, including generated passwords, private keys, connection strings and any provider output the configuration touched — regardless of whether the corresponding variable was marked sensitive. Sharing it organization-wide means anyone who can create a workspace can read the credentials of your production environment.
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

            if workspace.global_remote_state:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name} shares its remote state with every "
                    f"workspace in organization {workspace.organization}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.name} restricts remote state access to an "
                    f"explicit consumer list."
                )

            findings.append(report)

        return findings
