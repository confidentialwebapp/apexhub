from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.bitbucket.lib.service.service import BitbucketService


class Workspace(BitbucketService):
    """Retrieve Bitbucket workspaces with membership and access control settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, BitbucketWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_members, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for raw in self._paginate("/workspaces", "values"):
                workspace = BitbucketWorkspace(
                    uuid=raw.get("uuid", ""),
                    slug=raw.get("slug", ""),
                    name=raw.get("name", ""),
                    is_private=raw.get("is_private", True),
                    enforced_two_factor=bool(
                        raw.get("enforced_two_factor_auth", False)
                    ),
                    ip_allowlist_enabled=bool(raw.get("ip_allowlist_enabled", False)),
                )
                self.workspaces[workspace.slug] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_members(self, workspace: "BitbucketWorkspace"):
        try:
            for raw in (
                self._paginate(f"/workspaces/{workspace.slug}/permissions", "values") or []
            ):
                user = raw.get("user") or {}
                workspace.members.append(
                    BitbucketMember(
                        uuid=user.get("uuid", ""),
                        display_name=user.get("display_name", ""),
                        permission=raw.get("permission", "member"),
                        account_status=user.get("account_status", "active"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching members for {workspace.slug}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class BitbucketMember(BaseModel):
    """A member of a Bitbucket workspace."""

    uuid: str
    display_name: str = ""
    permission: str = "member"
    account_status: str = "active"


class BitbucketWorkspace(BaseModel):
    """Bitbucket workspace representation."""

    uuid: str
    slug: str = ""
    name: str = ""
    is_private: bool = True
    enforced_two_factor: bool = False
    ip_allowlist_enabled: bool = False
    members: list[BitbucketMember] = Field(default_factory=list)
