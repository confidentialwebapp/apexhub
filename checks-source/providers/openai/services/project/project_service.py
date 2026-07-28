from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class Project(OpenAIService):
    """Retrieve OpenAI projects with their service accounts and rate limits."""

    def __init__(self, provider):
        super().__init__("Project", provider)
        self.projects: dict[str, OpenAIProject] = {}
        self._list_projects()
        self.__threading_call__(
            self._get_project_detail, list(self.projects.values())
        )

    def _list_projects(self):
        try:
            for raw in self._paginate("/v1/organization/projects", "data"):
                project = OpenAIProject(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    status=raw.get("status", "active"),
                    created_at=raw.get("created_at"),
                )
                self.projects[project.id] = project
            logger.info(f"Project - Found {len(self.projects)} project(s)")
        except Exception as error:
            logger.error(
                f"Project - Error listing projects: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_project_detail(self, project: "OpenAIProject"):
        try:
            for raw in (
                self._paginate(
                    f"/v1/organization/projects/{project.id}/service_accounts", "data"
                )
                or []
            ):
                project.service_accounts.append(
                    OpenAIServiceAccount(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "member"),
                        created_at=raw.get("created_at"),
                    )
                )

            limits = self._paginate(
                f"/v1/organization/projects/{project.id}/rate_limits", "data"
            )
            project.rate_limits_configured = bool(limits)
        except Exception as error:
            logger.error(
                f"Project - Error fetching detail for {project.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OpenAIServiceAccount(BaseModel):
    """A service account belonging to an OpenAI project."""

    id: str
    name: str = ""
    role: str = "member"
    created_at: Optional[int] = None


class OpenAIProject(BaseModel):
    """OpenAI project representation."""

    id: str
    name: str = ""
    status: str = "active"
    created_at: Optional[int] = None
    rate_limits_configured: bool = False
    service_accounts: list[OpenAIServiceAccount] = Field(default_factory=list)
