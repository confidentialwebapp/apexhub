from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.unitycatalog.unitycatalog_client import unitycatalog_client


class databricks_unitycatalog_metastore_assigned(Check):
    """Databricks workspaces are assigned to a Unity Catalog metastore

    Outside Unity Catalog, data access is governed by legacy table ACLs that only some cluster modes enforce, and there is no lineage or centralised grant audit. Permissions drift independently in each workspace, so an access review in one place gives no assurance about the same data reached from another.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        findings = []
        metastore = unitycatalog_client.metastore

        report = CheckReportDatabricks(
            metadata=self.metadata(),
            resource=metastore or {},
            resource_name=self._base_url if metastore is None else metastore.metastore_id,
            resource_id="" if metastore is None else metastore.metastore_id,
        )

        if metastore is not None and metastore.metastore_id:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace is assigned to Unity Catalog metastore "
                f"{metastore.metastore_id} with default catalog "
                f"{metastore.default_catalog_name or '(none)'}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                "Workspace is not assigned to a Unity Catalog metastore."
            )

        findings.append(report)
        return findings
