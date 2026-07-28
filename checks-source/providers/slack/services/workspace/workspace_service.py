from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class Workspace(SlackService):
    """Retrieve Slack workspace and enterprise settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspace: Optional[SlackWorkspace] = None
        self._get_workspace()

    def _get_workspace(self):
        try:
            team = (self._get("/api/team.info") or {}).get("team", {})
            prefs = (self._get("/api/team.preferences.list") or {})
            # Audit logs are Enterprise Grid only; a readable page confirms access.
            audit = self._get("/api/audit/v1/logs", params={"limit": 1})

            self.workspace = SlackWorkspace(
                id=team.get("id", ""),
                name=team.get("name", ""),
                domain=team.get("domain", ""),
                email_domain=team.get("email_domain", ""),
                enterprise_id=team.get("enterprise_id"),
                sso_required=bool(prefs.get("sso_required", False)),
                two_factor_required=bool(
                    prefs.get("two_factor_auth_required", False)
                ),
                app_approval_required=bool(
                    prefs.get("app_management_approval_required", False)
                ),
                who_can_manage_apps=str(prefs.get("who_can_manage_apps", "")),
                message_retention_days=_as_int(prefs.get("msg_retention_duration")),
                file_retention_days=_as_int(prefs.get("file_retention_duration")),
                audit_logs_readable=audit is not None,
                enterprise_key_management=bool(prefs.get("ekm_enabled", False)),
            )
            logger.info(f"Workspace - Read configuration for {self.workspace.name}")
        except Exception as error:
            logger.error(
                f"Workspace - Error reading workspace configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class SlackWorkspace(BaseModel):
    """Slack workspace representation."""

    id: str
    name: str = ""
    domain: str = ""
    email_domain: str = ""
    enterprise_id: Optional[str] = None
    sso_required: bool = False
    two_factor_required: bool = False
    app_approval_required: bool = False
    who_can_manage_apps: str = ""
    message_retention_days: Optional[int] = None
    file_retention_days: Optional[int] = None
    audit_logs_readable: bool = False
    enterprise_key_management: bool = False
