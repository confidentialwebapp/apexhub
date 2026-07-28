/** Databricks — lakehouse workspace, compute and Unity Catalog posture. */

const workspace_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.databricks.lib.service.service import DatabricksService


class Workspace(DatabricksService):
    """Retrieve Databricks workspace security settings, IP access lists and tokens."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspace: Optional[DatabricksWorkspace] = None
        self._get_workspace()

    def _get_workspace(self):
        try:
            ip_lists = (self._get("/api/2.0/ip-access-lists") or {}).get(
                "ip_access_lists", []
            )
            tokens = (self._get("/api/2.0/token-management/tokens") or {}).get(
                "token_infos", []
            )
            settings = self._get("/api/2.0/workspace-conf", params={
                "keys": "enableIpAccessLists,enableTokensConfig,maxTokenLifetimeDays"
            }) or {}

            self.workspace = DatabricksWorkspace(
                host=self._base_url,
                workspace_id=self.provider.identity.workspace_id or "",
                ip_access_lists_enabled=str(
                    settings.get("enableIpAccessLists", "false")
                ).lower()
                == "true",
                max_token_lifetime_days=_as_int(settings.get("maxTokenLifetimeDays")),
                ip_access_lists=[
                    DatabricksIpAccessList(
                        list_id=raw.get("list_id", ""),
                        label=raw.get("label", ""),
                        list_type=raw.get("list_type", "ALLOW"),
                        enabled=raw.get("enabled", False),
                        ip_addresses=raw.get("ip_addresses", []),
                    )
                    for raw in ip_lists
                ],
                tokens=[
                    DatabricksToken(
                        token_id=raw.get("token_id", ""),
                        comment=raw.get("comment") or "",
                        created_by=raw.get("created_by_username") or "",
                        creation_time=raw.get("creation_time"),
                        expiry_time=raw.get("expiry_time"),
                    )
                    for raw in tokens
                ],
            )
            self._get_encryption_and_logging()
            logger.info(f"Workspace - Read configuration for {self._base_url}")
        except Exception as error:
            logger.error(
                f"Workspace - Error reading workspace configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_encryption_and_logging(self):
        """Read account-level log delivery and customer-managed key configuration."""
        account_id = self.provider.identity.account_id
        if not self.workspace or not account_id:
            return
        try:
            deliveries = (
                self._get(
                    f"/api/2.0/accounts/{account_id}/log-delivery"
                )
                or {}
            ).get("log_delivery_configurations", [])
            self.workspace.audit_log_deliveries = [
                DatabricksLogDelivery(
                    config_id=raw.get("config_id", ""),
                    config_name=raw.get("config_name", ""),
                    log_type=raw.get("log_type", ""),
                    status=(raw.get("status") or "DISABLED").upper(),
                )
                for raw in deliveries
            ]

            keys = (
                self._get(f"/api/2.0/accounts/{account_id}/customer-managed-keys") or {}
            ).get("customer_managed_keys", [])
            self.workspace.customer_managed_key_use_cases = sorted(
                {
                    use_case
                    for key in keys
                    for use_case in key.get("use_cases", [])
                }
            )
        except Exception as error:
            logger.error(
                f"Workspace - Error reading account configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class DatabricksIpAccessList(BaseModel):
    """An IP access list attached to a Databricks workspace."""

    list_id: str
    label: str = ""
    list_type: str = "ALLOW"
    enabled: bool = False
    ip_addresses: list[str] = Field(default_factory=list)


class DatabricksToken(BaseModel):
    """A personal access token issued in a Databricks workspace."""

    token_id: str
    comment: str = ""
    created_by: str = ""
    creation_time: Optional[int] = None
    expiry_time: Optional[int] = None


class DatabricksLogDelivery(BaseModel):
    """An account-level log delivery configuration."""

    config_id: str
    config_name: str = ""
    log_type: str = ""
    status: str = "DISABLED"


class DatabricksWorkspace(BaseModel):
    """Databricks workspace representation."""

    host: str
    workspace_id: str = ""
    ip_access_lists_enabled: bool = False
    max_token_lifetime_days: Optional[int] = None
    ip_access_lists: list[DatabricksIpAccessList] = Field(default_factory=list)
    tokens: list[DatabricksToken] = Field(default_factory=list)
    audit_log_deliveries: list[DatabricksLogDelivery] = Field(default_factory=list)
    customer_managed_key_use_cases: list[str] = Field(default_factory=list)
`;

const cluster_service = `from typing import Optional

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
`;

const unitycatalog_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.databricks.lib.service.service import DatabricksService


class UnityCatalog(DatabricksService):
    """Retrieve Unity Catalog metastore assignment, external locations and grants."""

    def __init__(self, provider):
        super().__init__("UnityCatalog", provider)
        self.metastore: Optional[DatabricksMetastore] = None
        self.external_locations: dict[str, DatabricksExternalLocation] = {}
        self._get_metastore()
        self._list_external_locations()
        self.__threading_call__(
            self._get_location_grants, list(self.external_locations.values())
        )

    def _get_metastore(self):
        try:
            raw = self._get("/api/2.1/unity-catalog/current-metastore-assignment")
            if raw:
                self.metastore = DatabricksMetastore(
                    metastore_id=raw.get("metastore_id", ""),
                    workspace_id=str(raw.get("workspace_id", "")),
                    default_catalog_name=raw.get("default_catalog_name"),
                )
                logger.info(
                    f"UnityCatalog - Workspace assigned to metastore "
                    f"{self.metastore.metastore_id}"
                )
            else:
                logger.info("UnityCatalog - Workspace has no metastore assignment.")
        except Exception as error:
            logger.error(
                f"UnityCatalog - Error reading metastore assignment: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _list_external_locations(self):
        try:
            data = self._get("/api/2.1/unity-catalog/external-locations") or {}
            for raw in data.get("external_locations", []):
                location = DatabricksExternalLocation(
                    name=raw.get("name", ""),
                    url=raw.get("url", ""),
                    credential_name=raw.get("credential_name", ""),
                    read_only=raw.get("read_only", False),
                    owner=raw.get("owner", ""),
                )
                self.external_locations[location.name] = location
            logger.info(
                f"UnityCatalog - Found {len(self.external_locations)} external location(s)"
            )
        except Exception as error:
            logger.error(
                f"UnityCatalog - Error listing external locations: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_location_grants(self, location: "DatabricksExternalLocation"):
        try:
            data = self._get(
                f"/api/2.1/unity-catalog/permissions/external_location/{location.name}"
            ) or {}
            for assignment in data.get("privilege_assignments", []):
                location.grants.append(
                    DatabricksGrant(
                        principal=assignment.get("principal", ""),
                        privileges=assignment.get("privileges", []),
                    )
                )
        except Exception as error:
            logger.error(
                f"UnityCatalog - Error fetching grants for {location.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class DatabricksGrant(BaseModel):
    """A privilege assignment on a Unity Catalog securable."""

    principal: str
    privileges: list[str] = Field(default_factory=list)


class DatabricksExternalLocation(BaseModel):
    """A Unity Catalog external location."""

    name: str
    url: str = ""
    credential_name: str = ""
    read_only: bool = False
    owner: str = ""
    grants: list[DatabricksGrant] = Field(default_factory=list)


class DatabricksMetastore(BaseModel):
    """The Unity Catalog metastore assigned to the workspace."""

    metastore_id: str
    workspace_id: str = ""
    default_catalog_name: Optional[str] = None
`;

export default {
  id: "databricks",
  name: "Databricks",
  pyClass: "Databricks",
  baseUrl: "https://<workspace>.cloud.databricks.com",
  selfHosted: true,
  samplePath: "/api/2.1/clusters/list",
  errorCodeBase: 14400,
  credentialsRemediation:
    "Set DATABRICKS_HOST to the workspace URL and DATABRICKS_TOKEN to a service principal OAuth token. Account-level checks additionally need DATABRICKS_ACCOUNT_ID and account admin scope.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Databricks assesses a Databricks workspace and its account across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers cluster isolation modes, init script provenance, secure cluster connectivity, IP access lists, personal access token lifetime, Unity Catalog governance and audit log delivery.",

  services: {
    workspace: { pyClass: "Workspace", source: workspace_service },
    cluster: { pyClass: "Cluster", source: cluster_service },
    unitycatalog: { pyClass: "UnityCatalog", source: unitycatalog_service },
  },

  checks: [
    {
      id: "databricks_cluster_init_scripts_from_trusted_source",
      service: "cluster",
      pillar: "attacksurface",
      severity: "critical",
      title: "Databricks cluster init scripts come from a governed source",
      resourceType: "Databricks::Cluster::InitScript",
      resourceGroup: "compute",
      categories: ["trust-boundaries", "ci-cd"],
      description:
        "Cluster **init scripts** run as root on every node before Spark starts. This check reports clusters whose init scripts are loaded from DBFS or a plain cloud storage URI rather than from a workspace file or a Unity Catalog volume, where access is governed and changes are attributable.",
      risk:
        "DBFS-hosted init scripts are writable by **any workspace user**, so anyone who can attach a notebook can modify a script that then executes as root on every node of every cluster using it. That is a direct path from ordinary analyst access to full compute takeover, including theft of the instance profile credentials the cluster uses to read the data lake.",
      urls: [
        "https://docs.databricks.com/en/init-scripts/index.html",
        "https://docs.databricks.com/en/dbfs/root-locations.html",
      ],
      relatedTo: ["databricks_cluster_unity_catalog_isolation_enforced"],
      remediation: {
        cli: "databricks clusters edit --json '{\"cluster_id\":\"<id>\",\"init_scripts\":[{\"workspace\":{\"destination\":\"/Shared/init/hardening.sh\"}}]}'",
        other:
          "1. Move each init script to a workspace file (`/Shared/init/...`) or a Unity Catalog volume\n2. Restrict write permission on that path to the platform team\n3. Update the cluster definition to reference the new location\n4. Disable DBFS-hosted init scripts at the workspace level so the pattern cannot return\n5. Review the DBFS script's history: if it was writable by all users, treat any credential the cluster could reach as potentially exposed",
        terraform:
          'resource "databricks_cluster" "etl" {\n  cluster_name = "etl"\n\n  init_scripts {\n    workspace {\n      destination = "/Shared/init/hardening.sh"\n    }\n  }\n}',
        text:
          "Host init scripts in workspace files or Unity Catalog volumes with write access limited to the platform team, and disable DBFS-hosted init scripts at the workspace level.",
      },
      body: `# Workspace files and Unity Catalog volumes carry governed ACLs; DBFS does not.
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

return findings`,
    },

    {
      id: "databricks_cluster_unity_catalog_isolation_enforced",
      service: "cluster",
      pillar: "iam",
      severity: "high",
      title: "Databricks clusters enforce a Unity Catalog access mode",
      resourceType: "Databricks::Cluster",
      resourceGroup: "compute",
      categories: ["trust-boundaries"],
      description:
        "A cluster's **data security mode** determines whether Unity Catalog governance applies to workloads running on it. This check reports clusters running in `NONE` or legacy no-isolation modes, where table ACLs and row filters are not enforced.",
      risk:
        "A no-isolation cluster executes every user's code in the **same JVM with the same identity**, so one user can read another's credentials in memory and bypass Unity Catalog grants entirely. The governance model appears intact in the catalog while the compute layer ignores it, which makes the gap easy to miss during review.",
      urls: [
        "https://docs.databricks.com/en/compute/configure.html#access-modes",
        "https://docs.databricks.com/en/data-governance/unity-catalog/index.html",
      ],
      relatedTo: ["databricks_cluster_init_scripts_from_trusted_source"],
      remediation: {
        cli: "databricks clusters edit --json '{\"cluster_id\":\"<id>\",\"data_security_mode\":\"USER_ISOLATION\"}'",
        other:
          "1. Open the cluster in the Databricks workspace\n2. Click **Edit** and set **Access mode** to `Shared` (user isolation) or `Single user`\n3. Migrate workloads that require a legacy mode to a supported runtime\n4. Use a cluster policy to prevent creation of no-isolation clusters\n5. Assign the workspace to a Unity Catalog metastore if it is not already",
        terraform:
          'resource "databricks_cluster" "analytics" {\n  cluster_name        = "analytics"\n  data_security_mode  = "USER_ISOLATION"\n  spark_version       = data.databricks_spark_version.lts.id\n}',
        text:
          "Run clusters in Shared (user isolation) or Single user access mode so Unity Catalog grants are enforced at compute time, and pin the setting with a cluster policy.",
      },
      body: `# Modes under which Unity Catalog grants are not enforced at compute time.
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

return findings`,
    },

    {
      id: "databricks_cluster_no_public_ip",
      service: "cluster",
      pillar: "attacksurface",
      severity: "high",
      title: "Databricks clusters run without public IP addresses",
      resourceType: "Databricks::Cluster",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "**Secure cluster connectivity** provisions cluster nodes without public IP addresses, so all communication with the control plane is outbound only. This check reports clusters whose cloud attributes still assign a public IP.",
      risk:
        "Cluster nodes with public IPs are **directly addressable from the internet**, exposing any service that binds to a routable interface — Spark UI ports, debugging endpoints and anything an init script starts. Because nodes carry the instance profile or managed identity used to read the data lake, a reachable node is a direct route to the underlying storage.",
      urls: [
        "https://docs.databricks.com/en/security/network/classic/secure-cluster-connectivity.html",
        "https://docs.databricks.com/en/security/network/index.html",
      ],
      remediation: {
        cli: "databricks clusters edit --json '{\"cluster_id\":\"<id>\",\"aws_attributes\":{\"no_public_ip\":true}}'",
        other:
          "1. Enable secure cluster connectivity on the workspace (it is the default for workspaces created recently; older workspaces may need recreation)\n2. Provision a NAT gateway so nodes retain outbound internet access for library installs\n3. Set `no_public_ip: true` in the cluster's cloud attributes\n4. Enforce it through a cluster policy so new clusters inherit it\n5. Restrict the workspace VPC/VNet security groups to the documented Databricks control plane ranges",
        terraform:
          'resource "databricks_cluster" "etl" {\n  cluster_name = "etl"\n\n  aws_attributes {\n    no_public_ip = true\n  }\n}',
        text:
          "Enable secure cluster connectivity so nodes have no public IPs, provide outbound access through a NAT gateway, and pin no_public_ip in a cluster policy.",
      },
      body: `findings = []
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

return findings`,
    },

    {
      id: "databricks_cluster_local_disk_encryption_enabled",
      service: "cluster",
      pillar: "encryption",
      severity: "medium",
      title: "Databricks clusters encrypt local disks",
      resourceType: "Databricks::Cluster",
      resourceGroup: "compute",
      categories: ["encryption"],
      description:
        "Databricks can encrypt the temporary storage attached to cluster nodes, covering shuffle files, cached data and spill. This check verifies that `enable_local_disk_encryption` is set on each cluster.",
      risk:
        "Spark writes intermediate results to local disk whenever a join or aggregation exceeds memory, so **production data lands unencrypted on node storage** even when the source tables are encrypted at rest. Snapshots, forensic images or a recovered instance store therefore expose data that governance controls in the catalog would otherwise protect.",
      urls: [
        "https://docs.databricks.com/en/security/keys/local-disk-encryption.html",
        "https://docs.databricks.com/en/security/keys/index.html",
      ],
      remediation: {
        cli: "databricks clusters edit --json '{\"cluster_id\":\"<id>\",\"enable_local_disk_encryption\":true}'",
        other:
          "1. Open the cluster in the Databricks workspace\n2. Click **Edit > Advanced options**\n3. Enable **Local disk encryption**\n4. Restart the cluster for the setting to take effect\n5. Add the setting to a cluster policy so new clusters inherit it\n6. Note the small performance cost on shuffle-heavy workloads and size accordingly",
        terraform:
          'resource "databricks_cluster" "etl" {\n  cluster_name                 = "etl"\n  enable_local_disk_encryption = true\n}',
        text:
          "Enable local disk encryption on all clusters and enforce it through a cluster policy so shuffle and spill data is protected on node storage.",
      },
      body: `findings = []
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

return findings`,
    },

    {
      id: "databricks_workspace_ip_access_list_enabled",
      service: "workspace",
      pillar: "attacksurface",
      severity: "high",
      title: "Databricks workspaces enforce IP access lists",
      resourceType: "Databricks::Workspace::IpAccessList",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "**IP access lists** restrict which source addresses may reach the Databricks workspace UI and REST API. This check verifies that the feature is enabled and that at least one enabled ALLOW list exists.",
      risk:
        "A Databricks personal access token is a **bearer credential usable from anywhere**, and it grants the ability to launch compute that reads the data lake. Without an IP access list, a token leaked through a notebook, a CI log or a laptop compromise can be used directly from the attacker's own infrastructure with no further obstacle.",
      urls: [
        "https://docs.databricks.com/en/security/network/front-end/ip-access-list.html",
        "https://docs.databricks.com/api/workspace/ipaccesslists",
      ],
      relatedTo: ["databricks_workspace_token_lifetime_limited"],
      remediation: {
        cli: "databricks workspace-conf set-status --json '{\"enableIpAccessLists\":\"true\"}'\ndatabricks ip-access-lists create --json '{\"label\":\"corp-egress\",\"list_type\":\"ALLOW\",\"ip_addresses\":[\"203.0.113.0/24\"]}'",
        other:
          "1. Collect the egress CIDR ranges for your offices, VPN and CI systems\n2. Create an ALLOW list containing those ranges\n3. Verify your own address is covered — an incorrect list locks everyone out of the workspace\n4. Enable the feature with `enableIpAccessLists`\n5. For front-end private access, prefer Private Link and keep the list as defence in depth\n6. Test that jobs and external tools still connect after enabling",
        terraform:
          'resource "databricks_workspace_conf" "this" {\n  custom_config = {\n    "enableIpAccessLists" = true\n  }\n}\n\nresource "databricks_ip_access_list" "corp" {\n  label        = "corp-egress"\n  list_type    = "ALLOW"\n  ip_addresses = ["203.0.113.0/24"]\n}',
        text:
          "Enable IP access lists with an ALLOW list covering corporate, VPN and CI egress ranges, and use Private Link for front-end access where available.",
      },
      body: `findings = []
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
return findings`,
    },

    {
      id: "databricks_workspace_token_lifetime_limited",
      service: "workspace",
      pillar: "iam",
      severity: "high",
      title: "Databricks personal access tokens have a bounded lifetime",
      resourceType: "Databricks::Workspace::Token",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check verifies that the workspace caps personal access token lifetime through `maxTokenLifetimeDays`, and reports individual tokens issued with no expiry at all.",
      risk:
        "A personal access token with no expiry is a **permanent credential carrying its owner's full workspace privileges**, and it keeps working after that person changes role or leaves the company. These tokens accumulate in notebooks, CI configuration and local files, so an old leak stays exploitable indefinitely and its use is attributed to the original user rather than the attacker.",
      urls: [
        "https://docs.databricks.com/en/admin/access-control/tokens.html",
        "https://docs.databricks.com/api/workspace/tokenmanagement",
      ],
      relatedTo: ["databricks_workspace_ip_access_list_enabled"],
      remediation: {
        cli: "databricks workspace-conf set-status --json '{\"maxTokenLifetimeDays\":\"90\"}'\ndatabricks token-management delete <token-id>",
        other:
          "1. Set `maxTokenLifetimeDays` to 90 or less in the workspace configuration\n2. List existing tokens and revoke any with no expiry\n3. Move automation to **service principals with OAuth (M2M)**, which issue short-lived tokens rather than static ones\n4. Restrict who may create personal access tokens through the token permissions API\n5. Rotate any token that has appeared in a notebook, log or repository",
        terraform:
          'resource "databricks_workspace_conf" "this" {\n  custom_config = {\n    "enableTokensConfig"   = true\n    "maxTokenLifetimeDays" = "90"\n  }\n}',
        text:
          "Cap token lifetime at 90 days or less, revoke non-expiring tokens, and move automation to service principal OAuth so credentials are short-lived and not tied to a person.",
      },
      body: `findings = []
workspace = workspace_client.workspace
if workspace is None:
    return findings

max_lifetime = workspace.max_token_lifetime_days
configured_cap = self.audit_config.get("max_token_lifetime_days", 90)

report = CheckReportDatabricks(
    metadata=self.metadata(),
    resource=workspace,
    resource_name=workspace.host,
    resource_id=workspace.workspace_id or workspace.host,
)

never_expiring = [token for token in workspace.tokens if not token.expiry_time]

if max_lifetime is not None and max_lifetime <= configured_cap and not never_expiring:
    report.status = "PASS"
    report.status_extended = (
        f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s) "
        f"and has no non-expiring tokens."
    )
elif max_lifetime is None:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.host} does not cap personal access token lifetime "
        f"({len(never_expiring)} token(s) never expire)."
    )
elif never_expiring:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s) "
        f"but {len(never_expiring)} existing token(s) never expire."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s), "
        f"above the {configured_cap} day threshold."
    )

findings.append(report)
return findings`,
    },

    {
      id: "databricks_workspace_audit_log_delivery_configured",
      service: "workspace",
      pillar: "logging",
      severity: "high",
      title: "Databricks accounts deliver audit logs to external storage",
      resourceType: "Databricks::Account::LogDelivery",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "Databricks **audit log delivery** writes account and workspace audit events to a cloud storage bucket you control. This check verifies that at least one enabled log delivery configuration exists.",
      risk:
        "Without log delivery, audit events are only queryable through the platform's own retention window, so there is **no independent record** of who launched compute, who queried which table, or who changed permissions. An attacker with workspace admin rights can alter configuration knowing the evidence expires, and incident responders lose the timeline needed to scope the breach.",
      urls: [
        "https://docs.databricks.com/en/admin/account-settings/audit-logs.html",
        "https://docs.databricks.com/api/account/logdelivery",
      ],
      remediation: {
        cli: "databricks account log-delivery create --json '{\"config_name\":\"audit-logs\",\"log_type\":\"AUDIT_LOGS\",\"output_format\":\"JSON\",\"credentials_id\":\"<id>\",\"storage_configuration_id\":\"<id>\"}'",
        other:
          "1. Create a storage bucket in your own cloud account for the logs\n2. Register a storage configuration and credential in the Databricks account console\n3. Create a log delivery configuration with `log_type = AUDIT_LOGS`\n4. Apply object-lock or equivalent immutability on the bucket so logs cannot be altered\n5. Forward the delivered logs into your SIEM and alert on metastore, permission and token events\n6. Confirm delivery is producing files before relying on it",
        terraform:
          'resource "databricks_mws_log_delivery" "audit" {\n  account_id               = var.databricks_account_id\n  credentials_id           = databricks_mws_credentials.log_writer.credentials_id\n  storage_configuration_id = databricks_mws_storage_configurations.logs.storage_configuration_id\n  log_type                 = "AUDIT_LOGS"\n  output_format            = "JSON"\n}',
        text:
          "Deliver audit logs to a bucket in your own cloud account with immutability enabled, forward them to your SIEM, and alert on permission, metastore and token events.",
      },
      body: `findings = []
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
return findings`,
    },

    {
      id: "databricks_workspace_customer_managed_key_configured",
      service: "workspace",
      pillar: "encryption",
      severity: "medium",
      title: "Databricks workspaces use customer-managed encryption keys",
      resourceType: "Databricks::Account::CustomerManagedKey",
      resourceGroup: "storage",
      categories: ["encryption"],
      description:
        "Databricks can encrypt managed services (notebooks, secrets, query history) and workspace storage with a **customer-managed key** held in your own cloud KMS. This check verifies that customer-managed keys are registered for both use cases.",
      risk:
        "With platform-managed keys only, you cannot **independently revoke access to your data** — key material is entirely under the provider's control, so containment during a suspected platform compromise depends on the provider acting. Customer-managed keys also give you the audit trail of key usage that most regulated data handling programmes expect.",
      urls: [
        "https://docs.databricks.com/en/security/keys/customer-managed-keys.html",
        "https://docs.databricks.com/api/account/encryptionkeys",
      ],
      remediation: {
        cli: "databricks account encryption-keys create --json '{\"aws_key_info\":{\"key_arn\":\"<arn>\",\"key_alias\":\"databricks\"},\"use_cases\":[\"MANAGED_SERVICES\",\"STORAGE\"]}'",
        other:
          "1. Create a KMS key (or Azure Key Vault key) in your own cloud account\n2. Grant the Databricks service principal the minimum key usage permissions\n3. Register the key in the Databricks account console for both `MANAGED_SERVICES` and `STORAGE`\n4. Attach it to the workspace — managed services keys can be added to an existing workspace, storage keys may require workspace recreation on some clouds\n5. Enable key rotation and monitor key usage in your cloud audit log",
        terraform:
          'resource "databricks_mws_customer_managed_keys" "this" {\n  account_id = var.databricks_account_id\n  aws_key_info {\n    key_arn   = aws_kms_key.databricks.arn\n    key_alias = aws_kms_alias.databricks.name\n  }\n  use_cases = ["MANAGED_SERVICES", "STORAGE"]\n}',
        text:
          "Register customer-managed keys for both managed services and workspace storage, enable rotation, and monitor key usage in your cloud audit log so you retain independent revocation.",
      },
      body: `REQUIRED_USE_CASES = {"MANAGED_SERVICES", "STORAGE"}

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
return findings`,
    },

    {
      id: "databricks_unitycatalog_metastore_assigned",
      service: "unitycatalog",
      pillar: "iam",
      severity: "medium",
      title: "Databricks workspaces are assigned to a Unity Catalog metastore",
      resourceType: "Databricks::UnityCatalog::Metastore",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "**Unity Catalog** provides centralised access control, lineage and audit for data across workspaces. This check verifies that the workspace has a metastore assignment, without which governance falls back to legacy per-workspace table ACLs.",
      risk:
        "Outside Unity Catalog, data access is governed by **legacy table ACLs that only some cluster modes enforce**, and there is no lineage or centralised grant audit. Permissions drift independently in each workspace, so an access review in one place gives no assurance about the same data reached from another.",
      urls: [
        "https://docs.databricks.com/en/data-governance/unity-catalog/index.html",
        "https://docs.databricks.com/api/workspace/metastores",
      ],
      relatedTo: ["databricks_unitycatalog_external_location_not_broadly_granted"],
      remediation: {
        cli: "databricks metastores assign <workspace-id> <metastore-id> <default-catalog>",
        other:
          "1. Create a Unity Catalog metastore in the account console for the workspace's region\n2. Assign the workspace to it and set a default catalog\n3. Migrate existing Hive metastore tables using the upgrade wizard or `SYNC`\n4. Move clusters to a Unity Catalog access mode so grants are enforced\n5. Review and re-apply grants in Unity Catalog — legacy ACLs are not carried over automatically",
        terraform:
          'resource "databricks_metastore_assignment" "this" {\n  workspace_id         = var.workspace_id\n  metastore_id         = databricks_metastore.primary.id\n  default_catalog_name = "main"\n}',
        text:
          "Assign each workspace to a Unity Catalog metastore, migrate legacy Hive tables, and move clusters to a governed access mode so grants are enforced consistently.",
      },
      body: `findings = []
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
return findings`,
    },

    {
      id: "databricks_unitycatalog_external_location_not_broadly_granted",
      service: "unitycatalog",
      pillar: "iam",
      severity: "high",
      title: "Unity Catalog external locations are not granted to all account users",
      resourceType: "Databricks::UnityCatalog::ExternalLocation",
      resourceGroup: "iam",
      categories: ["trust-boundaries"],
      description:
        "This check reports Unity Catalog **external locations** that grant privileges to the built-in `account users` group, or that grant `CREATE EXTERNAL TABLE` or `WRITE FILES` broadly.",
      risk:
        "An external location maps to a **cloud storage prefix**, so a grant on it bypasses table-level controls entirely — the holder can read the underlying files directly regardless of column masks or row filters applied to the tables above them. Granting to `account users` extends that raw storage access to everyone in the account, including service principals created for unrelated purposes.",
      urls: [
        "https://docs.databricks.com/en/connect/unity-catalog/external-locations.html",
        "https://docs.databricks.com/en/data-governance/unity-catalog/manage-privileges/index.html",
      ],
      relatedTo: ["databricks_unitycatalog_metastore_assigned"],
      remediation: {
        cli: "databricks grants update external_location <name> --json '{\"changes\":[{\"principal\":\"account users\",\"remove\":[\"READ_FILES\",\"WRITE_FILES\",\"CREATE_EXTERNAL_TABLE\"]}]}'",
        other:
          "1. Review grants with `SHOW GRANTS ON EXTERNAL LOCATION <name>`\n2. Remove privileges held by `account users`\n3. Grant `READ_FILES` and `WRITE_FILES` only to the specific groups that need raw storage access\n4. Prefer granting on catalogs, schemas and tables so column masks and row filters apply\n5. Mark locations that should never be written to as `read_only`\n6. Scope each external location to the narrowest storage prefix that works",
        terraform:
          'resource "databricks_grants" "curated" {\n  external_location = databricks_external_location.curated.id\n\n  grant {\n    principal  = "data-engineering"\n    privileges = ["READ_FILES"]\n  }\n}',
        text:
          "Remove broad grants from external locations, give raw storage access only to named engineering groups, and prefer table-level grants so masking and row filters remain effective.",
      },
      body: `BROAD_PRINCIPALS = {"account users", "users", "all account users"}
SENSITIVE_PRIVILEGES = {"WRITE_FILES", "CREATE_EXTERNAL_TABLE", "ALL_PRIVILEGES"}

findings = []
for location in unitycatalog_client.external_locations.values():
    report = CheckReportDatabricks(
        metadata=self.metadata(),
        resource=location,
        resource_name=location.name,
        resource_id=location.name,
    )

    problems = []
    for grant in location.grants:
        principal = (grant.principal or "").strip().lower()
        privileges = {privilege.upper() for privilege in grant.privileges}

        if principal in BROAD_PRINCIPALS and privileges:
            problems.append(
                f"{grant.principal} holds {', '.join(sorted(privileges))}"
            )
        elif privileges & SENSITIVE_PRIVILEGES and principal in BROAD_PRINCIPALS:
            problems.append(
                f"{grant.principal} holds {', '.join(sorted(privileges & SENSITIVE_PRIVILEGES))}"
            )

    if problems:
        report.status = "FAIL"
        report.status_extended = (
            f"External location {location.name} ({location.url}) is broadly "
            f"granted: {'; '.join(problems)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"External location {location.name} has no grants to built-in "
            f"account-wide groups."
        )

    findings.append(report)

return findings`,
    },
  ],
};
