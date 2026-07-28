from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.workspace.workspace_client import workspace_client


class databricks_workspace_customer_managed_key_configured(Check):
    """Databricks workspaces use customer-managed encryption keys

    With platform-managed keys only, you cannot independently revoke access to your data — key material is entirely under the provider's control, so containment during a suspected platform compromise depends on the provider acting. Customer-managed keys also give you the audit trail of key usage that most regulated data handling programmes expect.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        REQUIRED_USE_CASES = {"MANAGED_SERVICES", "STORAGE"}

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

        configured = {
            use_case.upper() for use_case in workspace.customer_managed_key_use_cases
        }
        missing = sorted(REQUIRED_USE_CASES - configured)

        if not missing:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.host} uses customer-managed keys for managed "
                f"services and storage."
            )
        elif configured:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} uses customer-managed keys for "
                f"{', '.join(sorted(configured))} but not for {', '.join(missing)}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} does not use customer-managed encryption keys."
            )

        findings.append(report)
        return findings
