from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.workspace.workspace_client import workspace_client


class databricks_workspace_ip_access_list_enabled(Check):
    """Databricks workspaces enforce IP access lists

    A Databricks personal access token is a bearer credential usable from anywhere, and it grants the ability to launch compute that reads the data lake. Without an IP access list, a token leaked through a notebook, a CI log or a laptop compromise can be used directly from the attacker's own infrastructure with no further obstacle.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        findings = []
        workspace = workspace_client.workspace
        if workspace is None:
            return findings

        report = CheckReportDatabricks(
            metadata=self.metadata(),
            resource=workspace,
            resource_name=workspace.host,
            resource_id=workspace.workspace_id or workspace.host,
        )

        allow_lists = [
            access_list
            for access_list in workspace.ip_access_lists
            if access_list.list_type == "ALLOW" and access_list.enabled
        ]

        if workspace.ip_access_lists_enabled and allow_lists:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.host} enforces IP access lists with "
                f"{len(allow_lists)} enabled ALLOW list(s)."
            )
        elif workspace.ip_access_lists_enabled:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} has IP access lists enabled but no enabled "
                f"ALLOW list, so the restriction has no effect."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} does not enforce IP access lists."
            )

        findings.append(report)
        return findings
