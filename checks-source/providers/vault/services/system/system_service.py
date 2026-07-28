from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class System(VaultService):
    """Retrieve Vault seal status, health and replication configuration."""

    def __init__(self, provider):
        super().__init__("System", provider)
        self.system: Optional[VaultSystem] = None
        self._get_system()

    def _get_system(self):
        try:
            seal = self._get("/v1/sys/seal-status") or {}
            health = self._get("/v1/sys/health") or {}
            # The config endpoint requires a root-equivalent token; absence is
            # handled by leaving the listener fields unknown.
            config = (self._get("/v1/sys/config/state/sanitized") or {}).get("data", {})
            listeners = config.get("listeners") or []

            self.system = VaultSystem(
                address=self._base_url,
                version=seal.get("version", health.get("version", "unknown")),
                sealed=bool(seal.get("sealed", True)),
                seal_type=seal.get("type", "shamir"),
                recovery_seal=bool(seal.get("recovery_seal", False)),
                key_shares=seal.get("n"),
                key_threshold=seal.get("t"),
                cluster_name=seal.get("cluster_name", ""),
                ha_enabled=bool(health.get("ha_enabled", False)),
                storage_type=seal.get("storage_type", config.get("storage_type", "")),
                listeners=[
                    VaultListener(
                        type=str(listener.get("type", "tcp")),
                        address=str(
                            (listener.get("config") or {}).get("address", "")
                        ),
                        tls_disable=_as_bool(
                            (listener.get("config") or {}).get("tls_disable", False)
                        ),
                    )
                    for listener in listeners
                    if isinstance(listener, dict)
                ],
            )
            logger.info(f"System - Read seal status for {self._base_url}")
        except Exception as error:
            logger.error(
                f"System - Error reading system configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "1", "yes", "on")


class VaultListener(BaseModel):
    """A Vault listener configuration."""

    type: str = "tcp"
    address: str = ""
    tls_disable: bool = False


class VaultSystem(BaseModel):
    """Vault cluster system representation."""

    address: str
    version: str = "unknown"
    sealed: bool = True
    seal_type: str = "shamir"
    recovery_seal: bool = False
    key_shares: Optional[int] = None
    key_threshold: Optional[int] = None
    cluster_name: str = ""
    ha_enabled: bool = False
    storage_type: str = ""
    listeners: list[VaultListener] = Field(default_factory=list)
