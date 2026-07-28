from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Secret(VaultService):
    """Retrieve Vault secret engine mounts and their lease tuning."""

    def __init__(self, provider):
        super().__init__("Secret", provider)
        self.mounts: dict[str, VaultSecretMount] = {}
        self._list_mounts()

    def _list_mounts(self):
        try:
            data = self._get("/v1/sys/mounts") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                config = raw.get("config") or {}
                options = raw.get("options") or {}
                mount = VaultSecretMount(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    default_lease_ttl=config.get("default_lease_ttl"),
                    max_lease_ttl=config.get("max_lease_ttl"),
                    kv_version=str(options.get("version", "")),
                    seal_wrap=raw.get("seal_wrap", False),
                    local=raw.get("local", False),
                )
                self.mounts[mount.path] = mount
            logger.info(f"Secret - Found {len(self.mounts)} secret engine mount(s)")
        except Exception as error:
            logger.error(
                f"Secret - Error listing secret engines: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultSecretMount(BaseModel):
    """Vault secret engine mount representation."""

    path: str
    type: str = ""
    description: str = ""
    default_lease_ttl: Optional[int] = None
    max_lease_ttl: Optional[int] = None
    kv_version: str = ""
    seal_wrap: bool = False
    local: bool = False
