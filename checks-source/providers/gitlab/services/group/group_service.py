from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.gitlab.lib.service.service import GitLabService


class Group(GitLabService):
    """Retrieve GitLab groups with authentication and audit configuration."""

    def __init__(self, provider):
        super().__init__("Group", provider)
        self.groups: dict[str, GitLabGroup] = {}
        self._list_groups()
        self.__threading_call__(self._get_audit_streaming, list(self.groups.values()))

    def _list_groups(self):
        try:
            for raw in self._paginate("/groups", params={"min_access_level": 40}):
                group = GitLabGroup(
                    id=str(raw.get("id")),
                    name=raw.get("name", ""),
                    full_path=raw.get("full_path", ""),
                    web_url=raw.get("web_url", ""),
                    visibility=raw.get("visibility", "private"),
                    require_two_factor_authentication=raw.get(
                        "require_two_factor_authentication", False
                    ),
                    two_factor_grace_period=raw.get("two_factor_grace_period", 48),
                    ip_restriction_ranges=[
                        cidr.strip()
                        for cidr in (raw.get("ip_restriction_ranges") or "").split(",")
                        if cidr.strip()
                    ],
                    shared_runners_setting=raw.get(
                        "shared_runners_setting", "enabled"
                    ),
                    prevent_forking_outside_group=raw.get(
                        "prevent_forking_outside_group", False
                    ),
                )
                self.groups[group.id] = group
            logger.info(f"Group - Found {len(self.groups)} group(s)")
        except Exception as error:
            logger.error(
                f"Group - Error listing groups: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_streaming(self, group: "GitLabGroup"):
        try:
            destinations = self._get(
                f"/groups/{group.id}/audit_events/external_audit_event_destinations"
            )
            if destinations:
                group.audit_streaming_destinations = [
                    dest.get("destination_url", "") for dest in destinations
                ]
        except Exception as error:
            logger.error(
                f"Group - Error fetching audit streaming for {group.full_path}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class GitLabGroup(BaseModel):
    """GitLab group (namespace) representation."""

    id: str
    name: str = ""
    full_path: str = ""
    web_url: str = ""
    visibility: str = "private"
    require_two_factor_authentication: bool = False
    two_factor_grace_period: Optional[int] = None
    ip_restriction_ranges: list[str] = Field(default_factory=list)
    shared_runners_setting: str = "enabled"
    prevent_forking_outside_group: bool = False
    audit_streaming_destinations: list[str] = Field(default_factory=list)
