from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Confluence(AtlassianService):
    """Retrieve Confluence spaces with their permission and anonymous access state."""

    def __init__(self, provider):
        super().__init__("Confluence", provider)
        self.spaces: dict[str, ConfluenceSpace] = {}
        self._list_spaces()
        self.__threading_call__(self._get_space_permissions, list(self.spaces.values()))

    def _list_spaces(self):
        try:
            cursor = None
            while True:
                params = {"limit": 100}
                if cursor:
                    params["cursor"] = cursor

                data = self._get("/wiki/api/v2/spaces", params=params)
                if data is None:
                    break

                for raw in data.get("results", []):
                    space = ConfluenceSpace(
                        id=str(raw.get("id", "")),
                        key=raw.get("key", ""),
                        name=raw.get("name", ""),
                        space_type=raw.get("type", "global"),
                        status=raw.get("status", "current"),
                    )
                    self.spaces[space.key] = space

                cursor = ((data.get("_links") or {}).get("next") or "").split(
                    "cursor="
                )[-1] or None
                if not cursor or "cursor=" not in ((data.get("_links") or {}).get("next") or ""):
                    break

            logger.info(f"Confluence - Found {len(self.spaces)} space(s)")
        except Exception as error:
            logger.error(
                f"Confluence - Error listing spaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_space_permissions(self, space: "ConfluenceSpace"):
        try:
            data = self._get(
                f"/wiki/api/v2/spaces/{space.id}/permissions",
                params={"limit": 250},
            )
            if data is None:
                return

            for raw in data.get("results", []):
                principal = raw.get("principal") or {}
                operation = raw.get("operation") or {}
                if principal.get("type") in ("anonymous", "unknown"):
                    space.anonymous_permissions.append(
                        f"{operation.get('key', '')}:{operation.get('targetType', '')}"
                    )
        except Exception as error:
            logger.error(
                f"Confluence - Error fetching permissions for {space.key}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class ConfluenceSpace(BaseModel):
    """Confluence space representation."""

    id: str
    key: str = ""
    name: str = ""
    space_type: str = "global"
    status: str = "current"
    anonymous_permissions: list[str] = Field(default_factory=list)
