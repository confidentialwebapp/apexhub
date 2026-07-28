from typing import Optional

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
