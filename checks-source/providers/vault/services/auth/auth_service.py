from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Auth(VaultService):
    """Retrieve Vault auth methods, their tuning and outstanding root tokens."""

    def __init__(self, provider):
        super().__init__("Auth", provider)
        self.methods: dict[str, VaultAuthMethod] = {}
        self.root_token_accessors: list[str] = []
        self._list_methods()
        self._find_root_tokens()

    def _list_methods(self):
        try:
            data = self._get("/v1/sys/auth") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                config = raw.get("config") or {}
                method = VaultAuthMethod(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    default_lease_ttl=config.get("default_lease_ttl"),
                    max_lease_ttl=config.get("max_lease_ttl"),
                    local=raw.get("local", False),
                )
                self.methods[method.path] = method
            logger.info(f"Auth - Found {len(self.methods)} auth method(s)")
        except Exception as error:
            logger.error(
                f"Auth - Error listing auth methods: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _find_root_tokens(self):
        """List token accessors and record those carrying the root policy."""
        try:
            listing = self._list("/v1/auth/token/accessors") or {}
            accessors = (listing.get("data") or {}).get("keys", [])

            for accessor in accessors:
                info = self._post(
                    "/v1/auth/token/lookup-accessor", {"accessor": accessor}
                )
                data = (info or {}).get("data") or {}
                if "root" in (data.get("policies") or []):
                    self.root_token_accessors.append(accessor)

            if self.root_token_accessors:
                logger.info(
                    f"Auth - Found {len(self.root_token_accessors)} root token(s)"
                )
        except Exception as error:
            logger.error(
                f"Auth - Error enumerating token accessors: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultAuthMethod(BaseModel):
    """Vault auth method representation."""

    path: str
    type: str = ""
    description: str = ""
    default_lease_ttl: Optional[int] = None
    max_lease_ttl: Optional[int] = None
    local: bool = False
