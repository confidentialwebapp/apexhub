from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.cluster.cluster_client import cluster_client


class databricks_cluster_local_disk_encryption_enabled(Check):
    """Databricks clusters encrypt local disks

    Spark writes intermediate results to local disk whenever a join or aggregation exceeds memory, so production data lands unencrypted on node storage even when the source tables are encrypted at rest. Snapshots, forensic images or a recovered instance store therefore expose data that governance controls in the catalog would otherwise protect.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        findings = []
        for cluster in cluster_client.clusters.values():
            report = CheckReportDatabricks(
                metadata=self.metadata(),
                resource=cluster,
                resource_name=cluster.cluster_name,
                resource_id=cluster.cluster_id,
            )

            if cluster.enable_local_disk_encryption:
                report.status = "PASS"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} encrypts local disks."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} does not encrypt local disks."
                )

            findings.append(report)

        return findings
