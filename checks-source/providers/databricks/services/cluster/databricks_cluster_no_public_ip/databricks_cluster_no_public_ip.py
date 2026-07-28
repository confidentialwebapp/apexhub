from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.cluster.cluster_client import cluster_client


class databricks_cluster_no_public_ip(Check):
    """Databricks clusters run without public IP addresses

    Cluster nodes with public IPs are directly addressable from the internet, exposing any service that binds to a routable interface — Spark UI ports, debugging endpoints and anything an init script starts. Because nodes carry the instance profile or managed identity used to read the data lake, a reachable node is a direct route to the underlying storage.
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

            if cluster.public_ip_enabled:
                report.status = "FAIL"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} provisions nodes with public IP "
                    f"addresses."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Cluster {cluster.cluster_name} provisions nodes without public IP "
                    f"addresses."
                )

            findings.append(report)

        return findings
