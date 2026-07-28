from typing import Optional

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
