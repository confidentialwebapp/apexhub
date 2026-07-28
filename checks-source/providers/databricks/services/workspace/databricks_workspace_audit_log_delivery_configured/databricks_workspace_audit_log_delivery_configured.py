from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.workspace.workspace_client import workspace_client


class databricks_workspace_audit_log_delivery_configured(Check):
    """Databricks accounts deliver audit logs to external storage

    Without log delivery, audit events are only queryable through the platform's own retention window, so there is no independent record of who launched compute, who queried which table, or who changed permissions. An attacker with workspace admin rights can alter configuration knowing the evidence expires, and incident responders lose the timeline needed to scope the breach.
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

        enabled = [
            delivery
            for delivery in workspace.audit_log_deliveries
            if delivery.status == "ENABLED" and "AUDIT" in delivery.log_type.upper()
        ]

        if enabled:
            report.status = "PASS"
            report.status_extended = (
                f"Account for workspace {workspace.host} delivers audit logs through "
                f"{len(enabled)} enabled configuration(s)."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Account for workspace {workspace.host} has no enabled audit log delivery "
                f"configuration."
            )

        findings.append(report)
        return findings
