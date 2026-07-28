from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class ApiKey(OpenAIService):
    """Retrieve OpenAI admin and project API keys with their ownership and age."""

    def __init__(self, provider):
        super().__init__("ApiKey", provider)
        self.keys: dict[str, OpenAIApiKey] = {}
        self._list_admin_keys()
        self._list_project_keys()

    def _list_admin_keys(self):
        try:
            for raw in self._paginate("/v1/organization/admin_api_keys", "data"):
                key = OpenAIApiKey(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    scope="organization",
                    project_id=None,
                    owner_type=(raw.get("owner") or {}).get("type", "user"),
                    owner_name=(raw.get("owner") or {}).get("name", ""),
                    created_at=raw.get("created_at"),
                    last_used_at=raw.get("last_used_at"),
                )
                self.keys[key.id] = key
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing admin API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _list_project_keys(self):
        try:
            for project in self._paginate("/v1/organization/projects", "data"):
                project_id = project.get("id", "")
                for raw in (
                    self._paginate(
                        f"/v1/organization/projects/{project_id}/api_keys", "data"
                    )
                    or []
                ):
                    owner = raw.get("owner") or {}
                    key = OpenAIApiKey(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        scope="project",
                        project_id=project_id,
                        project_name=project.get("name", ""),
                        owner_type=owner.get("type", "user"),
                        owner_name=(owner.get("service_account") or owner.get("user") or {}).get(
                            "name", ""
                        ),
                        created_at=raw.get("created_at"),
                        last_used_at=raw.get("last_used_at"),
                    )
                    self.keys[key.id] = key
            logger.info(f"ApiKey - Found {len(self.keys)} API key(s)")
        except Exception as error:
            logger.error(
                f"ApiKey - Error listing project API keys: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OpenAIApiKey(BaseModel):
    """OpenAI API key representation."""

    id: str
    name: str = ""
    scope: str = "project"
    project_id: Optional[str] = None
    project_name: str = ""
    owner_type: str = "user"
    owner_name: str = ""
    created_at: Optional[int] = None
    last_used_at: Optional[int] = None
