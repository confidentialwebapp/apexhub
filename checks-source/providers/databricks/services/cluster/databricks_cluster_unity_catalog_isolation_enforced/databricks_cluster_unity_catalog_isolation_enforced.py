from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.cluster.cluster_client import cluster_client


class databricks_cluster_unity_catalog_isolation_enforced(Check):
    """Databricks clusters enforce a Unity Catalog access mode

    A no-isolation cluster executes every user's code in the same JVM with the same identity, so one user can read another's credentials in memory and bypass Unity Catalog grants entirely. The governance model appears intact in the catalog while the compute layer ignores it, which makes the gap easy to miss during review.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        # Modes under which Unity Catalog grants are not enforced at compute time.
        UNGOVERNED_MODES = {
            "NONE",
            "LEGACY_PASSTHROUGH",
            "LEGACY_TABLE_ACL",
            "LEGACY_SINGLE_USER",
            "LEGACY_SINGLE_USER_STANDARD",
        }

        findings = []
        for cluster in cluster_client.clusters.values():
            report = CheckReportDatabricks(
                metadata=self.metadata(),
                resource=cluster,
                resource_name=cluster.cluster_name,
                resource_id=cluster.cluster_id,
            )

            mode = (cluster.data_security_mode or "NONE").upper()

            if mode in UNGOVERNED_MODES:
                report.status = "FAIL"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} runs in access mode {mode}, which does "
                    f"not enforce Unity Catalog governance."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} runs in access mode {mode}."
                )

            findings.append(report)

        return findings
