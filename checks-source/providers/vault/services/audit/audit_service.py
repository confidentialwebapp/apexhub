from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Audit(VaultService):
    """Retrieve enabled Vault audit devices."""

    def __init__(self, provider):
        super().__init__("Audit", provider)
        self.devices: dict[str, VaultAuditDevice] = {}
        self._list_devices()

    def _list_devices(self):
        try:
            data = self._get("/v1/sys/audit") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                options = raw.get("options") or {}
                device = VaultAuditDevice(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    file_path=options.get("file_path", ""),
                    log_raw=str(options.get("log_raw", "false")).lower() == "true",
                    hmac_accessor=str(
                        options.get("hmac_accessor", "true")
                    ).lower()
                    == "true",
                )
                self.devices[device.path] = device
            logger.info(f"Audit - Found {len(self.devices)} audit device(s)")
        except Exception as error:
            logger.error(
                f"Audit - Error listing audit devices: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultAuditDevice(BaseModel):
    """Vault audit device representation."""

    path: str
    type: str = ""
    description: str = ""
    file_path: str = ""
    log_raw: bool = False
    hmac_accessor: bool = True
