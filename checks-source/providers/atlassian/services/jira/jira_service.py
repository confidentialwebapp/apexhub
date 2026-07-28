from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Jira(AtlassianService):
    """Retrieve Jira projects with their permission scheme and anonymous access."""

    def __init__(self, provider):
        super().__init__("Jira", provider)
        self.projects: dict[str, JiraProject] = {}
        self._list_projects()
        self._get_global_permissions()

    def _list_projects(self):
        try:
            start_at = 0
            while True:
                data = self._get(
                    "/rest/api/3/project/search",
                    params={
                        "startAt": start_at,
                        "maxResults": 50,
                        "expand": "permissions,description",
                    },
                )
                if data is None:
                    break

                for raw in data.get("values", []):
                    project = JiraProject(
                        id=str(raw.get("id", "")),
                        key=raw.get("key", ""),
                        name=raw.get("name", ""),
                        project_type=raw.get("projectTypeKey", ""),
                        is_private=raw.get("isPrivate", True),
                    )
                    self.projects[project.key] = project

                if data.get("isLast", True):
                    break
                start_at += data.get("maxResults", 50)

            logger.info(f"Jira - Found {len(self.projects)} project(s)")
        except Exception as error:
            logger.error(
                f"Jira - Error listing projects: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_global_permissions(self):
        """Detect whether anonymous users hold any global Jira permission."""
        try:
            data = self._get("/rest/api/3/permissionscheme", params={
                "expand": "permissions,holder"
            }) or {}
            for scheme in data.get("permissionSchemes", []):
                for grant in (scheme.get("permissions") or []):
                    holder = grant.get("holder") or {}
                    if holder.get("type") != "anyone":
                        continue
                    for project in self.projects.values():
                        project.anonymous_grants.append(
                            grant.get("permission", "unknown")
                        )
        except Exception as error:
            logger.error(
                f"Jira - Error reading permission schemes: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JiraProject(BaseModel):
    """Jira project representation."""

    id: str
    key: str = ""
    name: str = ""
    project_type: str = ""
    is_private: bool = True
    anonymous_grants: list[str] = Field(default_factory=list)
