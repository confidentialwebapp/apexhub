from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.databricks.lib.service.service import DatabricksService


class Workspace(DatabricksService):
    """Retrieve Databricks workspace security settings, IP access lists and tokens."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspace: Optional[DatabricksWorkspace] = None
        self._get_workspace()

    def _get_workspace(self):
        try:
            ip_lists = (self._get("/api/2.0/ip-access-lists") or {}).get(
                "ip_access_lists", []
            )
            tokens = (self._get("/api/2.0/token-management/tokens") or {}).get(
                "token_infos", []
            )
            settings = self._get("/api/2.0/workspace-conf", params={
                "keys": "enableIpAccessLists,enableTokensConfig,maxTokenLifetimeDays"
            }) or {}

            self.workspace = DatabricksWorkspace(
                host=self._base_url,
                workspace_id=self.provider.identity.workspace_id or "",
                ip_access_lists_enabled=str(
                    settings.get("enableIpAccessLists", "false")
                ).lower()
                == "true",
                max_token_lifetime_days=_as_int(settings.get("maxTokenLifetimeDays")),
                ip_access_lists=[
                    DatabricksIpAccessList(
                        list_id=raw.get("list_id", ""),
                        label=raw.get("label", ""),
                        list_type=raw.get("list_type", "ALLOW"),
                        enabled=raw.get("enabled", False),
                        ip_addresses=raw.get("ip_addresses", []),
                    )
                    for raw in ip_lists
                ],
                tokens=[
                    DatabricksToken(
                        token_id=raw.get("token_id", ""),
                        comment=raw.get("comment") or "",
                        created_by=raw.get("created_by_username") or "",
                        creation_time=raw.get("creation_time"),
                        expiry_time=raw.get("expiry_time"),
                    )
                    for raw in tokens
                ],
            )
            self._get_encryption_and_logging()
            logger.info(f"Workspace - Read configuration for {self._base_url}")
        except Exception as error:
            logger.error(
                f"Workspace - Error reading workspace configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_encryption_and_logging(self):
        """Read account-level log delivery and customer-managed key configuration."""
        account_id = self.provider.identity.account_id
        if not self.workspace or not account_id:
            return
        try:
            deliveries = (
                self._get(
                    f"/api/2.0/accounts/{account_id}/log-delivery"
                )
                or {}
            ).get("log_delivery_configurations", [])
            self.workspace.audit_log_deliveries = [
                DatabricksLogDelivery(
                    config_id=raw.get("config_id", ""),
                    config_name=raw.get("config_name", ""),
                    log_type=raw.get("log_type", ""),
                    status=(raw.get("status") or "DISABLED").upper(),
                )
                for raw in deliveries
            ]

            keys = (
                self._get(f"/api/2.0/accounts/{account_id}/customer-managed-keys") or {}
            ).get("customer_managed_keys", [])
            self.workspace.customer_managed_key_use_cases = sorted(
                {
                    use_case
                    for key in keys
                    for use_case in key.get("use_cases", [])
                }
            )
        except Exception as error:
            logger.error(
                f"Workspace - Error reading account configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class DatabricksIpAccessList(BaseModel):
    """An IP access list attached to a Databricks workspace."""

    list_id: str
    label: str = ""
    list_type: str = "ALLOW"
    enabled: bool = False
    ip_addresses: list[str] = Field(default_factory=list)


class DatabricksToken(BaseModel):
    """A personal access token issued in a Databricks workspace."""

    token_id: str
    comment: str = ""
    created_by: str = ""
    creation_time: Optional[int] = None
    expiry_time: Optional[int] = None


class DatabricksLogDelivery(BaseModel):
    """An account-level log delivery configuration."""

    config_id: str
    config_name: str = ""
    log_type: str = ""
    status: str = "DISABLED"


class DatabricksWorkspace(BaseModel):
    """Databricks workspace representation."""

    host: str
    workspace_id: str = ""
    ip_access_lists_enabled: bool = False
    max_token_lifetime_days: Optional[int] = None
    ip_access_lists: list[DatabricksIpAccessList] = Field(default_factory=list)
    tokens: list[DatabricksToken] = Field(default_factory=list)
    audit_log_deliveries: list[DatabricksLogDelivery] = Field(default_factory=list)
    customer_managed_key_use_cases: list[str] = Field(default_factory=list)
