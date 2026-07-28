/**
 * MongoDB Atlas — first-party checks extending the vendored upstream provider,
 * which covers cluster encryption/backup/TLS and project network access.
 *
 * This layer adds database user privilege scoping, API key hygiene, private
 * endpoint connectivity and alerting, which upstream does not reach.
 */

const access_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.mongodbatlas.lib.service.service import MongoDBAtlasService


class Access(MongoDBAtlasService):
    """Retrieve Atlas database users, API keys, private endpoints and alerts."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.database_users: dict[str, AtlasDatabaseUser] = {}
        self.api_keys: dict[str, AtlasApiKey] = {}
        self.private_endpoints: dict[str, AtlasPrivateEndpoint] = {}
        self.alert_configs: dict[str, list] = {}
        self._load()

    def _paged(self, endpoint: str) -> list:
        """Fetch every page of an Atlas list endpoint."""
        results = []
        page = 1
        while True:
            data = self._make_request(
                "GET", f"{endpoint}?itemsPerPage=500&pageNum={page}"
            )
            if not data:
                break
            batch = data.get("results", [])
            results.extend(batch)
            if len(batch) < 500:
                break
            page += 1
        return results

    def _load(self):
        try:
            for org_id in self.provider.identity.organization_ids:
                for raw in self._paged(f"/api/atlas/v2/orgs/{org_id}/apiKeys"):
                    key = AtlasApiKey(
                        id=raw.get("id", ""),
                        organization_id=org_id,
                        description=raw.get("desc", ""),
                        public_key=raw.get("publicKey", ""),
                        roles=[
                            role.get("roleName", "")
                            for role in raw.get("roles", [])
                        ],
                    )
                    self.api_keys[key.id] = key

            for project_id in self.provider.identity.project_ids:
                self._load_project(project_id)

            logger.info(
                f"Access - Found {len(self.database_users)} database user(s), "
                f"{len(self.api_keys)} API key(s), "
                f"{len(self.private_endpoints)} private endpoint(s)"
            )
        except Exception as error:
            logger.error(
                f"Access - Error loading access configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _load_project(self, project_id: str):
        try:
            for raw in self._paged(
                f"/api/atlas/v2/groups/{project_id}/databaseUsers"
            ):
                user = AtlasDatabaseUser(
                    username=raw.get("username", ""),
                    project_id=project_id,
                    database=raw.get("databaseName", "admin"),
                    auth_type=_auth_type(raw),
                    roles=[
                        AtlasRole(
                            role_name=role.get("roleName", ""),
                            database_name=role.get("databaseName", ""),
                            collection_name=role.get("collectionName"),
                        )
                        for role in raw.get("roles", [])
                    ],
                    scopes=[
                        scope.get("name", "") for scope in raw.get("scopes", [])
                    ],
                )
                self.database_users[f"{project_id}:{user.username}"] = user

            for raw in self._paged(
                f"/api/atlas/v2/groups/{project_id}/privateEndpoint/regionalModes"
            ) or []:
                pass  # regional mode carries no per-endpoint detail

            for provider_name in ("AWS", "AZURE", "GCP"):
                services = self._make_request(
                    "GET",
                    f"/api/atlas/v2/groups/{project_id}/privateEndpoint/"
                    f"{provider_name}/endpointService",
                )
                for raw in services or []:
                    endpoint = AtlasPrivateEndpoint(
                        id=raw.get("id", ""),
                        project_id=project_id,
                        cloud_provider=provider_name,
                        status=raw.get("status", "UNKNOWN"),
                        region=raw.get("regionName", raw.get("region", "")),
                    )
                    self.private_endpoints[f"{project_id}:{endpoint.id}"] = endpoint

            alerts = self._paged(
                f"/api/atlas/v2/groups/{project_id}/alertConfigs"
            )
            self.alert_configs[project_id] = [
                alert for alert in alerts if alert.get("enabled")
            ]
        except Exception as error:
            logger.error(
                f"Access - Error loading project {project_id}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _auth_type(raw: dict) -> str:
    """Derive the authentication mechanism from the user's auth database."""
    database = raw.get("databaseName", "admin")
    if database == "$external":
        if raw.get("awsIAMType", "NONE") != "NONE":
            return "AWS_IAM"
        if raw.get("oidcAuthType", "NONE") != "NONE":
            return "OIDC"
        if raw.get("x509Type", "NONE") != "NONE":
            return "X509"
        return "LDAP"
    return "SCRAM"


class AtlasRole(BaseModel):
    """A role granted to an Atlas database user."""

    role_name: str
    database_name: str = ""
    collection_name: Optional[str] = None


class AtlasDatabaseUser(BaseModel):
    """Atlas database user representation."""

    username: str
    project_id: str = ""
    database: str = "admin"
    auth_type: str = "SCRAM"
    roles: list[AtlasRole] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)


class AtlasApiKey(BaseModel):
    """Atlas organization API key representation."""

    id: str
    organization_id: str = ""
    description: str = ""
    public_key: str = ""
    roles: list[str] = Field(default_factory=list)


class AtlasPrivateEndpoint(BaseModel):
    """Atlas private endpoint service representation."""

    id: str
    project_id: str = ""
    cloud_provider: str = ""
    status: str = "UNKNOWN"
    region: str = ""
`;

export default {
  id: "mongodbatlas",
  name: "MongoDB Atlas",
  pyClass: "MongoDBAtlas",
  extendsUpstream: true,
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for MongoDB Atlas assesses an Atlas organization and its projects across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It extends upstream cluster and network coverage with database user privilege scoping, workload identity authentication, organization API key roles, private endpoint connectivity and alert configuration.",

  newServices: {
    access: { pyClass: "Access", source: access_service },
  },

  checks: [
    {
      id: "access_database_user_no_admin_roles",
      service: "access",
      pillar: "iam",
      severity: "high",
      title: "Atlas database users do not hold cluster-wide administrative roles",
      resourceType: "MongoDBAtlas::DatabaseUser",
      resourceGroup: "iam",
      categories: ["authentication", "trust-boundaries"],
      description:
        "This check reports database users granted `atlasAdmin`, `dbAdminAnyDatabase`, `readWriteAnyDatabase` or `root`, which apply across every database in the cluster rather than to the one an application needs.",
      risk:
        "An application credential holding `readWriteAnyDatabase` can read and modify **every database on the cluster**, so a single SQL-injection-equivalent flaw or a leaked connection string exposes unrelated tenants and services sharing that cluster. `atlasAdmin` goes further, allowing the user to alter the cluster itself — including disabling the auditing that would record what happened.",
      urls: [
        "https://www.mongodb.com/docs/atlas/security-add-mongodb-users/",
        "https://www.mongodb.com/docs/atlas/mongodb-users-roles-and-privileges/",
      ],
      relatedTo: ["access_database_user_scoped_to_clusters"],
      remediation: {
        cli: "atlas dbusers update <username> --projectId <project-id> \\\n  --role readWrite@appdb",
        other:
          "1. In the Atlas UI, go to **Database Access**\n2. Edit each user holding an `*AnyDatabase` or `atlasAdmin` role\n3. Replace it with a role scoped to the specific database the application uses, such as `readWrite@appdb`\n4. Create a **custom role** where the built-in roles are still broader than needed\n5. Restart the application and confirm it operates correctly on the narrowed role\n6. Keep `atlasAdmin` for a small number of named human administrators only",
        terraform:
          'resource "mongodbatlas_database_user" "app" {\n  project_id         = var.project_id\n  username           = "app"\n  auth_database_name = "admin"\n\n  roles {\n    role_name     = "readWrite"\n    database_name = "appdb"\n  }\n}',
        text:
          "Replace cluster-wide roles with database-scoped ones or custom roles, and reserve atlasAdmin for a small named set of human administrators.",
      },
      body: `BROAD_ROLES = {
    "atlasAdmin",
    "root",
    "dbAdminAnyDatabase",
    "readWriteAnyDatabase",
    "readAnyDatabase",
    "clusterAdmin",
    "backup",
    "restore",
}

findings = []
for user in access_client.database_users.values():
    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=user,
        resource_name=f"{user.project_id}/{user.username}",
        resource_id=user.username,
    )

    broad = sorted(
        {role.role_name for role in user.roles if role.role_name in BROAD_ROLES}
    )

    if broad:
        report.status = "FAIL"
        report.status_extended = (
            f"Database user {user.username} holds cluster-wide role(s): "
            f"{', '.join(broad)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Database user {user.username} holds {len(user.roles)} scoped role(s)."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "access_database_user_scoped_to_clusters",
      service: "access",
      pillar: "iam",
      severity: "medium",
      title: "Atlas database users are scoped to specific clusters",
      resourceType: "MongoDBAtlas::DatabaseUser",
      resourceGroup: "iam",
      categories: ["authentication", "trust-boundaries"],
      description:
        "Atlas lets a database user be **restricted to named clusters or data lakes** within the project. This check reports users with no scope set, which grants them access to every cluster in the project including ones created later.",
      risk:
        "An unscoped user automatically gains access to **clusters created after the credential was issued**, so a project's blast radius grows silently as new environments are added. Where production and non-production clusters share a project, an unscoped development credential is a working production credential.",
      urls: [
        "https://www.mongodb.com/docs/atlas/security-add-mongodb-users/#std-label-database-users",
        "https://www.mongodb.com/docs/atlas/reference/api-resources-spec/",
      ],
      relatedTo: ["access_database_user_no_admin_roles"],
      remediation: {
        cli: "atlas dbusers update <username> --projectId <project-id> \\\n  --scope <cluster-name>:CLUSTER",
        other:
          "1. In the Atlas UI, go to **Database Access** and edit the user\n2. Under **Restrict Access to Specific Clusters/Federated Database Instances**, select only the clusters the credential needs\n3. Separate production and non-production workloads into **different projects** rather than relying on scope alone\n4. Re-test the application after scoping\n5. Review scopes when a new cluster is added to the project",
        terraform:
          'resource "mongodbatlas_database_user" "app" {\n  project_id         = var.project_id\n  username           = "app"\n  auth_database_name = "admin"\n\n  scopes {\n    name = mongodbatlas_cluster.app.name\n    type = "CLUSTER"\n  }\n}',
        text:
          "Scope each database user to the clusters it needs, and put production in a separate project from non-production rather than relying on scoping alone.",
      },
      body: `findings = []
for user in access_client.database_users.values():
    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=user,
        resource_name=f"{user.project_id}/{user.username}",
        resource_id=user.username,
    )

    if user.scopes:
        report.status = "PASS"
        report.status_extended = (
            f"Database user {user.username} is scoped to "
            f"{len(user.scopes)} resource(s): {', '.join(user.scopes)}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Database user {user.username} is not scoped and can access every "
            f"cluster in project {user.project_id}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "access_database_user_workload_identity_auth",
      service: "access",
      pillar: "iam",
      severity: "medium",
      title: "Atlas application database users authenticate with workload identity",
      resourceType: "MongoDBAtlas::DatabaseUser",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "Atlas supports **AWS IAM, OIDC and X.509** authentication in place of SCRAM passwords. This check reports database users still authenticating with a static SCRAM password.",
      risk:
        "A SCRAM password is embedded in the **connection string**, which propagates into environment files, container images, CI logs and application error traces. It does not expire and rotating it requires a coordinated deployment, so in practice it stays unchanged for years. Workload identity removes the stored secret entirely: the credential is issued per session against an identity the cloud provider attests.",
      urls: [
        "https://www.mongodb.com/docs/atlas/security/passwordless-authentication/",
        "https://www.mongodb.com/docs/atlas/workforce-oidc/",
      ],
      relatedTo: ["access_database_user_no_admin_roles"],
      remediation: {
        cli: "atlas dbusers create --projectId <project-id> \\\n  --awsIAMType ROLE --username arn:aws:iam::123456789012:role/app \\\n  --role readWrite@appdb",
        other:
          "1. Identify the workload's cloud identity — an IAM role, a Kubernetes service account, or a workload federation identity\n2. Create an Atlas database user of the corresponding type (`AWS_IAM`, `OIDC` or `X509`)\n3. Grant it the same scoped roles the password user held\n4. Update the application's connection string to use the matching auth mechanism\n5. Verify connectivity, then delete the SCRAM user\n6. For human access, use federated authentication rather than shared database passwords",
        terraform:
          'resource "mongodbatlas_database_user" "app" {\n  project_id         = var.project_id\n  username           = aws_iam_role.app.arn\n  auth_database_name = "$external"\n  aws_iam_type       = "ROLE"\n\n  roles {\n    role_name     = "readWrite"\n    database_name = "appdb"\n  }\n}',
        text:
          "Move application users to AWS IAM, OIDC or X.509 authentication so no static password is stored, and delete the SCRAM user once connectivity is verified.",
      },
      body: `PASSWORDLESS = {"AWS_IAM", "OIDC", "X509", "LDAP"}

findings = []
for user in access_client.database_users.values():
    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=user,
        resource_name=f"{user.project_id}/{user.username}",
        resource_id=user.username,
    )

    if user.auth_type in PASSWORDLESS:
        report.status = "PASS"
        report.status_extended = (
            f"Database user {user.username} authenticates with "
            f"{user.auth_type}, so no static password is stored."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Database user {user.username} authenticates with a static SCRAM "
            f"password."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "access_api_key_least_privilege",
      service: "access",
      pillar: "iam",
      severity: "high",
      title: "Atlas organization API keys do not hold owner privileges",
      resourceType: "MongoDBAtlas::ApiKey",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check reports organization API keys granted `ORG_OWNER` or `GROUP_OWNER`, which allow creating and deleting clusters, changing network access lists and issuing further credentials.",
      risk:
        "An owner-scoped API key is a **long-lived credential with full control of the Atlas organization**, and it is typically stored in the automation that provisions clusters — CI variables, Terraform state, or a configuration file. Its compromise allows an attacker to open the network access list to the internet and create a database user, reaching the data without touching any existing credential.",
      urls: [
        "https://www.mongodb.com/docs/atlas/configure-api-access/",
        "https://www.mongodb.com/docs/atlas/reference/user-roles/",
      ],
      relatedTo: ["access_private_endpoint_configured"],
      remediation: {
        cli: "atlas organizations apiKeys update <api-key-id> \\\n  --role ORG_READ_ONLY",
        other:
          "1. In Atlas, go to **Organization Settings > Access Manager > API Keys**\n2. For each key, review its roles and reduce them to the minimum the automation needs\n3. Prefer project-scoped keys (`GROUP_DATA_ACCESS_READ_ONLY`, `GROUP_CLUSTER_MANAGER`) over organization-wide ones\n4. Set an **API access list** on every key so it only works from your automation's egress addresses\n5. Rotate keys on a schedule and delete those with no recent use\n6. Store keys in a secrets manager, never in a repository or CI variable in plaintext",
        terraform:
          'resource "mongodbatlas_project_api_key" "ci" {\n  project_id  = var.project_id\n  description = "ci-provisioner"\n\n  project_assignment {\n    project_id = var.project_id\n    role_names = ["GROUP_CLUSTER_MANAGER"]\n  }\n}',
        text:
          "Reduce API keys to the narrowest project-scoped role that works, bind each key to an API access list, rotate on a schedule, and store them in a secrets manager.",
      },
      body: `OWNER_ROLES = {"ORG_OWNER", "GROUP_OWNER"}

findings = []
for key in access_client.api_keys.values():
    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=key,
        resource_name=key.description or key.id,
        resource_id=key.id,
    )

    owner_roles = sorted({role for role in key.roles if role in OWNER_ROLES})

    if owner_roles:
        report.status = "FAIL"
        report.status_extended = (
            f"API key {key.description or key.id} holds owner role(s): "
            f"{', '.join(owner_roles)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"API key {key.description or key.id} holds "
            f"{len(key.roles)} non-owner role(s)."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "access_private_endpoint_configured",
      service: "access",
      pillar: "attacksurface",
      severity: "high",
      title: "Atlas projects reach clusters over a private endpoint",
      resourceType: "MongoDBAtlas::PrivateEndpoint",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "A **private endpoint** connects Atlas clusters to your VPC over the cloud provider's private link, removing the need to expose them to public internet addresses. This check reports projects with no available private endpoint service.",
      risk:
        "Without a private endpoint, cluster connections traverse the **public internet** and access depends entirely on the IP access list — which breaks the moment an application's egress address changes and is routinely widened under operational pressure. Private endpoints make the cluster unreachable from the internet regardless of what the access list says, which is a materially stronger control.",
      urls: [
        "https://www.mongodb.com/docs/atlas/security-private-endpoint/",
        "https://www.mongodb.com/docs/atlas/setup-cluster-security/",
      ],
      relatedTo: ["access_api_key_least_privilege"],
      remediation: {
        cli: "atlas privateEndpoints aws create --region us-east-1 --projectId <project-id>",
        other:
          "1. In Atlas, go to **Network Access > Private Endpoint**\n2. Create a private endpoint service for the cloud provider and region your workloads run in\n3. Create the corresponding VPC endpoint (AWS PrivateLink, Azure Private Link, GCP Private Service Connect) in your own account\n4. Update application connection strings to the private endpoint SRV address\n5. Once traffic is confirmed flowing privately, remove the public entries from the IP access list\n6. Enable the private endpoint **regional mode** where you have workloads in multiple regions",
        terraform:
          'resource "mongodbatlas_privatelink_endpoint" "this" {\n  project_id    = var.project_id\n  provider_name = "AWS"\n  region        = "US_EAST_1"\n}',
        text:
          "Create a private endpoint for each region your workloads run in, move connection strings to the private SRV address, and then remove public entries from the IP access list.",
      },
      body: `findings = []
by_project: dict = {}
for endpoint in access_client.private_endpoints.values():
    by_project.setdefault(endpoint.project_id, []).append(endpoint)

for project_id in self.provider.identity.project_ids:
    endpoints = by_project.get(project_id, [])

    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=endpoints,
        resource_name=project_id,
        resource_id=project_id,
    )

    available = [
        endpoint
        for endpoint in endpoints
        if endpoint.status.upper() in ("AVAILABLE", "WAITING_FOR_USER")
    ]

    if available:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project_id} has {len(available)} private endpoint "
            f"service(s) across "
            f"{', '.join(sorted({endpoint.cloud_provider for endpoint in available}))}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project_id} has no private endpoint service; clusters are "
            f"reachable only over public addresses."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "access_alert_configurations_defined",
      service: "access",
      pillar: "logging",
      severity: "medium",
      title: "Atlas projects define enabled alert configurations",
      resourceType: "MongoDBAtlas::AlertConfiguration",
      resourceGroup: "logging",
      categories: ["logging", "resilience"],
      description:
        "This check verifies that each project has **enabled alert configurations**, so security-relevant events — user additions, access list changes and authentication failures — generate a notification.",
      risk:
        "Atlas auditing records events but does not act on them, so without alerts a **network access list widened to 0.0.0.0/0 or a new database user created by an attacker** goes unnoticed until someone happens to review the configuration. Those two actions are precisely how an intruder converts stolen API access into data access, and both are cheap to alert on.",
      urls: [
        "https://www.mongodb.com/docs/atlas/configure-alerts/",
        "https://www.mongodb.com/docs/atlas/reference/alert-conditions/",
      ],
      relatedTo: ["access_private_endpoint_configured"],
      remediation: {
        cli: "atlas alerts settings create --projectId <project-id> \\\n  --event USER_ROLES_CHANGED_AUDIT --enabled \\\n  --notificationType GROUP --notificationEmailEnabled",
        other:
          "1. In Atlas, go to **Project Settings > Alerts**\n2. Enable alerts for `USER_ROLES_CHANGED_AUDIT`, `NETWORK_PERMISSION_ENTRY_ADDED`, `JOINED_GROUP` and authentication failure conditions\n3. Route notifications to a monitored channel — PagerDuty, a SIEM webhook or a team alias, not an individual\n4. Add operational alerts for disk usage and replication lag alongside the security ones\n5. Test each alert fires as expected rather than assuming it will",
        terraform:
          'resource "mongodbatlas_alert_configuration" "roles_changed" {\n  project_id = var.project_id\n  event_type = "USER_ROLES_CHANGED_AUDIT"\n  enabled    = true\n\n  notification {\n    type_name     = "GROUP"\n    interval_min  = 5\n    email_enabled = true\n  }\n}',
        text:
          "Enable alerts on role changes, network access list additions and project membership changes, route them to a monitored channel rather than an individual, and test that each fires.",
      },
      body: `findings = []
for project_id in self.provider.identity.project_ids:
    enabled = access_client.alert_configs.get(project_id, [])

    report = CheckReportMongoDBAtlas(
        metadata=self.metadata(),
        resource=enabled,
        resource_name=project_id,
        resource_id=project_id,
    )

    if enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project_id} has {len(enabled)} enabled alert "
            f"configuration(s)."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project_id} has no enabled alert configuration."
        )

    findings.append(report)

return findings`,
    },
  ],
};
