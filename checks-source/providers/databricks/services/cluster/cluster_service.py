from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.databricks.lib.service.service import DatabricksService


class Cluster(DatabricksService):
    """Retrieve Databricks clusters with isolation, network and init script config."""

    def __init__(self, provider):
        super().__init__("Cluster", provider)
        self.clusters: dict[str, DatabricksCluster] = {}
        self._list_clusters()

    def _list_clusters(self):
        try:
            data = self._get("/api/2.1/clusters/list") or {}
            for raw in data.get("clusters", []):
                spark_conf = raw.get("spark_conf") or {}
                cluster = DatabricksCluster(
                    cluster_id=raw.get("cluster_id", ""),
                    cluster_name=raw.get("cluster_name", ""),
                    state=raw.get("state", "UNKNOWN"),
                    cluster_source=raw.get("cluster_source", "UI"),
                    data_security_mode=raw.get(
                        "data_security_mode", raw.get("access_mode", "NONE")
                    ),
                    single_user_name=raw.get("single_user_name"),
                    enable_local_disk_encryption=raw.get(
                        "enable_local_disk_encryption", False
                    ),
                    enable_elastic_disk=raw.get("enable_elastic_disk", False),
                    runtime_version=raw.get("spark_version", ""),
                    encryption_in_transit=str(
                        spark_conf.get(
                            "spark.databricks.io.encryption.enabled", "false"
                        )
                    ).lower()
                    == "true",
                    init_scripts=[
                        DatabricksInitScript(
                            source=next(iter(script.keys()), "unknown"),
                            destination=next(iter(script.values()), {}).get(
                                "destination", ""
                            ),
                        )
                        for script in raw.get("init_scripts", [])
                        if isinstance(script, dict) and script
                    ],
                    public_ip_enabled=not _no_public_ip(raw),
                )
                self.clusters[cluster.cluster_id] = cluster
            logger.info(f"Cluster - Found {len(self.clusters)} cluster(s)")
        except Exception as error:
            logger.error(
                f"Cluster - Error listing clusters: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _no_public_ip(raw: dict) -> bool:
    """True when the cluster is provisioned without a public IP on either cloud."""
    aws = raw.get("aws_attributes") or {}
    azure = raw.get("azure_attributes") or {}
    gcp = raw.get("gcp_attributes") or {}
    return bool(
        aws.get("no_public_ip")
        or azure.get("no_public_ip")
        or gcp.get("no_public_ip")
    )


class DatabricksInitScript(BaseModel):
    """An init script attached to a Databricks cluster."""

    source: str = "unknown"
    destination: str = ""


class DatabricksCluster(BaseModel):
    """Databricks cluster representation."""

    cluster_id: str
    cluster_name: str = ""
    state: str = "UNKNOWN"
    cluster_source: str = "UI"
    data_security_mode: str = "NONE"
    single_user_name: Optional[str] = None
    enable_local_disk_encryption: bool = False
    enable_elastic_disk: bool = False
    runtime_version: str = ""
    encryption_in_transit: bool = False
    public_ip_enabled: bool = True
    init_scripts: list[DatabricksInitScript] = Field(default_factory=list)
