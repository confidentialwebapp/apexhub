from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class App(SlackService):
    """Retrieve installed Slack apps with their granted OAuth scopes."""

    def __init__(self, provider):
        super().__init__("App", provider)
        self.apps: dict[str, SlackApp] = {}
        self._list_apps()

    def _list_apps(self):
        try:
            data = self._get("/api/admin.apps.approved.list", params={"limit": 200})
            approved = (data or {}).get("approved_apps", [])
            for entry in approved:
                self._add_app(entry, approved=True)

            data = self._get("/api/admin.apps.restricted.list", params={"limit": 200})
            for entry in (data or {}).get("restricted_apps", []):
                self._add_app(entry, approved=False)

            logger.info(f"App - Found {len(self.apps)} installed app(s)")
        except Exception as error:
            logger.error(
                f"App - Error listing apps: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _add_app(self, entry: dict, approved: bool):
        raw = entry.get("app") or {}
        app = SlackApp(
            id=raw.get("id", ""),
            name=raw.get("name", ""),
            is_approved=approved,
            is_internal=bool(raw.get("is_app_directory_approved") is False),
            app_directory_approved=bool(raw.get("is_app_directory_approved", False)),
            scopes=[
                scope.get("name", "")
                for scope in raw.get("scopes", [])
                if isinstance(scope, dict)
            ]
            or list(raw.get("scopes", []) if isinstance(raw.get("scopes"), list) else []),
            installed_by=(entry.get("last_resolved_by") or {}).get("actor_id", ""),
        )
        if app.id:
            self.apps[app.id] = app


class SlackApp(BaseModel):
    """Slack installed app representation."""

    id: str
    name: str = ""
    is_approved: bool = False
    is_internal: bool = False
    app_directory_approved: bool = False
    scopes: list[str] = Field(default_factory=list)
    installed_by: str = ""
