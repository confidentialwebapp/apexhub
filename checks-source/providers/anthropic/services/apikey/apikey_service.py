from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class ApiKey(AnthropicService):
    """Retrieve Anthropic API keys with workspace scope, status and age."""

    def __init__(self, provider):
        super().__init__("ApiKey", provider)
        self.keys: dict[str, AnthropicApiKey] = {}
        self._list_keys()

    def _list_keys(self):
        try:
            for raw in self._paginate("/v1/organizations/api_keys", "data"):
                key = AnthropicApiKey(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    status=raw.get("status", "active"),
                    workspace_id=raw.get("workspace_id"),
                    created_at=raw.get("created_at"),
                    created_by=(raw.get("created_by") or {}).get("id", ""),
                    partial_key_hint=raw.get("partial_key_hint", ""),
                )
                self.keys[key.id] = key
            logger.info(f"ApiKey - Found {len(self.keys)} API key(s)")
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AnthropicApiKey(BaseModel):
    """Anthropic API key representation."""

    id: str
    name: str = ""
    status: str = "active"
    workspace_id: Optional[str] = None
    created_at: Optional[str] = None
    created_by: str = ""
    partial_key_hint: str = ""
