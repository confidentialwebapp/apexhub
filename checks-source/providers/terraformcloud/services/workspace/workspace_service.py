from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.terraformcloud.lib.service.service import TerraformCloudService


class Workspace(TerraformCloudService):
    """Retrieve HCP Terraform workspaces with their variables and sharing settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, TerraformWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_variables, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for organization in self.provider.identity.organizations:
                for raw in self._paginate(
                    f"/api/v2/organizations/{organization}/workspaces", "data"
                ):
                    attributes = raw.get("attributes") or {}
                    workspace = TerraformWorkspace(
                        id=raw.get("id", ""),
                        name=attributes.get("name", ""),
                        organization=organization,
                        auto_apply=bool(attributes.get("auto-apply", False)),
                        execution_mode=attributes.get("execution-mode", "remote"),
                        global_remote_state=bool(
                            attributes.get("global-remote-state", False)
                        ),
                        speculative_enabled=bool(
                            attributes.get("speculative-enabled", True)
                        ),
                        assessments_enabled=bool(
                            attributes.get("assessments-enabled", False)
                        ),
                        terraform_version=attributes.get("terraform-version", ""),
                        locked=bool(attributes.get("locked", False)),
                    )
                    self.workspaces[workspace.id] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_variables(self, workspace: "TerraformWorkspace"):
        try:
            for raw in (
                self._paginate(f"/api/v2/workspaces/{workspace.id}/vars", "data") or []
            ):
                attributes = raw.get("attributes") or {}
                workspace.variables.append(
                    TerraformVariable(
                        id=raw.get("id", ""),
                        key=attributes.get("key", ""),
                        category=attributes.get("category", "terraform"),
                        sensitive=bool(attributes.get("sensitive", False)),
                        hcl=bool(attributes.get("hcl", False)),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching variables for {workspace.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class TerraformVariable(BaseModel):
    """A workspace variable in HCP Terraform."""

    id: str
    key: str = ""
    category: str = "terraform"
    sensitive: bool = False
    hcl: bool = False


class TerraformWorkspace(BaseModel):
    """HCP Terraform workspace representation."""

    id: str
    name: str = ""
    organization: str = ""
    auto_apply: bool = False
    execution_mode: str = "remote"
    global_remote_state: bool = False
    speculative_enabled: bool = True
    assessments_enabled: bool = False
    terraform_version: str = ""
    locked: bool = False
    variables: list[TerraformVariable] = Field(default_factory=list)
