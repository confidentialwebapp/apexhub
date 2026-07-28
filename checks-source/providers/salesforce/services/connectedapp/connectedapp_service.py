from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.salesforce.lib.service.service import SalesforceService


class ConnectedApp(SalesforceService):
    """Retrieve Salesforce connected apps and their OAuth configuration."""

    def __init__(self, provider):
        super().__init__("ConnectedApp", provider)
        self.apps: dict[str, SalesforceConnectedApp] = {}
        self._list_apps()

    def _tooling_query(self, soql: str) -> list[dict]:
        data = self._get("/services/data/v61.0/tooling/query", params={"q": soql})
        return (data or {}).get("records", [])

    def _list_apps(self):
        try:
            rows = self._tooling_query(
                "SELECT Id, Name, OptionsAllowAdminApprovedUsersOnly, "
                "OptionsRefreshTokenValidityMetric, CallbackUrl, Scopes, "
                "OptionsRequireProofKeyForCodeExchange "
                "FROM ConnectedApplication"
            )
            for raw in rows:
                app = SalesforceConnectedApp(
                    id=raw.get("Id", ""),
                    name=raw.get("Name", ""),
                    admin_approved_users_only=bool(
                        raw.get("OptionsAllowAdminApprovedUsersOnly")
                    ),
                    require_pkce=bool(
                        raw.get("OptionsRequireProofKeyForCodeExchange")
                    ),
                    callback_urls=[
                        url.strip()
                        for url in (raw.get("CallbackUrl") or "").split()
                        if url.strip()
                    ],
                    scopes=_parse_scopes(raw.get("Scopes")),
                )
                self.apps[app.id] = app
            logger.info(f"ConnectedApp - Found {len(self.apps)} connected app(s)")
        except Exception as error:
            logger.error(
                f"ConnectedApp - Error listing connected apps: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _parse_scopes(value) -> list[str]:
    if isinstance(value, list):
        return [str(scope) for scope in value]
    if isinstance(value, str):
        return [scope.strip() for scope in value.split(";") if scope.strip()]
    return []


class SalesforceConnectedApp(BaseModel):
    """Salesforce connected app representation."""

    id: str
    name: str = ""
    admin_approved_users_only: bool = False
    require_pkce: bool = False
    callback_urls: list[str] = Field(default_factory=list)
    scopes: list[str] = Field(default_factory=list)
