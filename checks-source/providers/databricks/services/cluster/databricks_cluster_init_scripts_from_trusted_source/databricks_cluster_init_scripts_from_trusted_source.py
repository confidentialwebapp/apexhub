from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.cluster.cluster_client import cluster_client


class databricks_cluster_init_scripts_from_trusted_source(Check):
    """Databricks cluster init scripts come from a governed source

    DBFS-hosted init scripts are writable by any workspace user, so anyone who can attach a notebook can modify a script that then executes as root on every node of every cluster using it. That is a direct path from ordinary analyst access to full compute takeover, including theft of the instance profile credentials the cluster uses to read the data lake.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        # Workspace files and Unity Catalog volumes carry governed ACLs; DBFS does not.
        TRUSTED_SOURCES = {"workspace", "volumes"}

        findings = []
        for cluster in cluster_client.clusters.values():
            if not cluster.init_scripts:
                continue

            for script in cluster.init_scripts:
                report = CheckReportDatabricks(
                    metadata=self.metadata(),
                    resource=script,
                    resource_name=f"{cluster.cluster_name}/{script.destination}",
                    resource_id=cluster.cluster_id,
                )

                if script.source in TRUSTED_SOURCES:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Cluster {cluster.cluster_name} loads init script "
                        f"{script.destination} from a governed {script.source} location."
                    )
                else:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Cluster {cluster.cluster_name} loads init script "
                        f"{script.destination} from {script.source}, which is not access "
                        f"controlled per user."
                    )

                findings.append(report)

        return findings
