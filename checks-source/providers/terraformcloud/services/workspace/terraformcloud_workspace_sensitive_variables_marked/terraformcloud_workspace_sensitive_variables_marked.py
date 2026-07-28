from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.workspace.workspace_client import workspace_client


class terraformcloud_workspace_sensitive_variables_marked(Check):
    """HCP Terraform workspace variables holding credentials are marked sensitive

    A non-sensitive variable's value is readable by every user with workspace read access and returned by the API, and it appears in plan output where it is retained in run history indefinitely. Because these variables typically hold the cloud credentials Terraform provisions with, one exposed value grants the same access Terraform itself has — which is usually administrative.
    """

    def execute(self) -> List[CheckReportTerraformCloud]:
        SECRET_HINTS = (
            "secret",
            "token",
            "password",
            "passwd",
            "apikey",
            "api_key",
            "private_key",
            "credential",
            "access_key",
            "client_secret",
        )

        findings = []
        for workspace in workspace_client.workspaces.values():
            for variable in workspace.variables:
                key_lower = variable.key.lower()
                if not any(hint in key_lower for hint in SECRET_HINTS):
                    continue

                report = CheckReportTerraformCloud(
                    metadata=self.metadata(),
                    resource=variable,
                    resource_name=f"{workspace.name}/{variable.key}",
                    resource_id=variable.id,
                )

                if variable.sensitive:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Variable {variable.key} in workspace {workspace.name} is marked "
                        f"sensitive."
                    )
                else:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Variable {variable.key} in workspace {workspace.name} appears to "
                        f"hold a credential but is not marked sensitive."
                    )

                findings.append(report)

        return findings
