from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class Workspace(AnthropicService):
    """Retrieve Anthropic workspaces with their spend limits and member roles."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, AnthropicWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_members, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for raw in self._paginate("/v1/organizations/workspaces", "data"):
                workspace = AnthropicWorkspace(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    archived_at=raw.get("archived_at"),
                    spend_limit_usd=_as_float(raw.get("spend_limit")),
                    rate_limit_configured=bool(raw.get("rate_limit")),
                    created_at=raw.get("created_at"),
                )
                self.workspaces[workspace.id] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_members(self, workspace: "AnthropicWorkspace"):
        try:
            for raw in (
                self._paginate(
                    f"/v1/organizations/workspaces/{workspace.id}/members", "data"
                )
                or []
            ):
                workspace.members.append(
                    AnthropicWorkspaceMember(
                        user_id=raw.get("user_id", ""),
                        role=raw.get("workspace_role", "workspace_user"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching members for {workspace.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_float(value) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class AnthropicWorkspaceMember(BaseModel):
    """A member assignment within an Anthropic workspace."""

    user_id: str
    role: str = "workspace_user"


class AnthropicWorkspace(BaseModel):
    """Anthropic workspace representation."""

    id: str
    name: str = ""
    archived_at: Optional[str] = None
    spend_limit_usd: Optional[float] = None
    rate_limit_configured: bool = False
    created_at: Optional[str] = None
    members: list[AnthropicWorkspaceMember] = Field(default_factory=list)
