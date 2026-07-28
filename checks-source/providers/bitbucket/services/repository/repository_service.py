from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.bitbucket.lib.service.service import BitbucketService


class Repository(BitbucketService):
    """Retrieve Bitbucket repositories with branch restrictions and pipeline config."""

    def __init__(self, provider):
        super().__init__("Repository", provider)
        self.repositories: dict[str, BitbucketRepository] = {}
        self._list_repositories()
        self.__threading_call__(
            self._get_branch_restrictions, list(self.repositories.values())
        )
        self.__threading_call__(
            self._get_deploy_keys, list(self.repositories.values())
        )
        self.__threading_call__(
            self._get_pipeline_variables, list(self.repositories.values())
        )

    def _list_repositories(self):
        try:
            for workspace in self.provider.identity.workspaces:
                for raw in self._paginate(f"/repositories/{workspace}", "values"):
                    repo = BitbucketRepository(
                        uuid=raw.get("uuid", ""),
                        full_name=raw.get("full_name", ""),
                        workspace=workspace,
                        is_private=raw.get("is_private", True),
                        main_branch=(raw.get("mainbranch") or {}).get("name"),
                        has_wiki=raw.get("has_wiki", False),
                        fork_policy=raw.get("fork_policy", "allow_forks"),
                    )
                    self.repositories[repo.full_name] = repo
            logger.info(f"Repository - Found {len(self.repositories)} repository(ies)")
        except Exception as error:
            logger.error(
                f"Repository - Error listing repositories: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_branch_restrictions(self, repo: "BitbucketRepository"):
        try:
            for raw in (
                self._paginate(f"/repositories/{repo.full_name}/branch-restrictions", "values")
                or []
            ):
                repo.branch_restrictions.append(
                    BitbucketBranchRestriction(
                        kind=raw.get("kind", ""),
                        pattern=(raw.get("branch_match_kind") == "branching_model")
                        and (raw.get("branch_type") or "")
                        or (raw.get("pattern") or ""),
                        value=raw.get("value"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Repository - Error fetching branch restrictions for {repo.full_name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_deploy_keys(self, repo: "BitbucketRepository"):
        try:
            for raw in (
                self._paginate(f"/repositories/{repo.full_name}/deploy-keys", "values") or []
            ):
                repo.deploy_keys.append(
                    BitbucketDeployKey(
                        id=str(raw.get("id", "")),
                        label=raw.get("label", ""),
                        last_used=raw.get("last_used"),
                        added_on=raw.get("added_on"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Repository - Error fetching deploy keys for {repo.full_name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_pipeline_variables(self, repo: "BitbucketRepository"):
        try:
            for raw in (
                self._paginate(
                    f"/repositories/{repo.full_name}/pipelines_config/variables", "values"
                )
                or []
            ):
                repo.pipeline_variables.append(
                    BitbucketPipelineVariable(
                        uuid=raw.get("uuid", ""),
                        key=raw.get("key", ""),
                        secured=raw.get("secured", False),
                    )
                )
        except Exception as error:
            logger.error(
                f"Repository - Error fetching pipeline variables for {repo.full_name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class BitbucketBranchRestriction(BaseModel):
    """A branch restriction rule on a Bitbucket repository."""

    kind: str
    pattern: str = ""
    value: Optional[int] = None


class BitbucketDeployKey(BaseModel):
    """An SSH deploy key registered on a Bitbucket repository."""

    id: str
    label: str = ""
    last_used: Optional[str] = None
    added_on: Optional[str] = None


class BitbucketPipelineVariable(BaseModel):
    """A Bitbucket Pipelines repository variable."""

    uuid: str
    key: str = ""
    secured: bool = False


class BitbucketRepository(BaseModel):
    """Bitbucket repository representation."""

    uuid: str
    full_name: str = ""
    workspace: str = ""
    is_private: bool = True
    main_branch: Optional[str] = None
    has_wiki: bool = False
    fork_policy: str = "allow_forks"
    branch_restrictions: list[BitbucketBranchRestriction] = Field(default_factory=list)
    deploy_keys: list[BitbucketDeployKey] = Field(default_factory=list)
    pipeline_variables: list[BitbucketPipelineVariable] = Field(default_factory=list)
