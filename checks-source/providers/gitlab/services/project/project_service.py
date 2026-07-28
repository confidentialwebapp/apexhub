from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.gitlab.lib.service.service import GitLabService


class Project(GitLabService):
    """Retrieve GitLab projects with protection, approval and CI configuration."""

    def __init__(self, provider):
        super().__init__("Project", provider)
        self.projects: dict[str, GitLabProject] = {}
        self._list_projects()
        self.__threading_call__(self._get_protected_branches, list(self.projects.values()))
        self.__threading_call__(self._get_approval_settings, list(self.projects.values()))
        self.__threading_call__(self._get_push_rules, list(self.projects.values()))
        self.__threading_call__(self._get_ci_variables, list(self.projects.values()))
        self.__threading_call__(self._get_job_token_scope, list(self.projects.values()))

    def _list_projects(self):
        try:
            for raw in self._paginate("/projects", params={"membership": True, "archived": False}):
                project = GitLabProject(
                    id=str(raw.get("id")),
                    name=raw.get("name", ""),
                    path_with_namespace=raw.get("path_with_namespace", ""),
                    web_url=raw.get("web_url", ""),
                    visibility=raw.get("visibility", "private"),
                    default_branch=raw.get("default_branch"),
                    archived=raw.get("archived", False),
                    container_registry_access_level=raw.get(
                        "container_registry_access_level", "disabled"
                    ),
                    secret_detection_enabled=bool(
                        raw.get("security_and_compliance_enabled", False)
                    ),
                )
                self.projects[project.id] = project
            logger.info(f"Project - Found {len(self.projects)} project(s)")
        except Exception as error:
            logger.error(
                f"Project - Error listing projects: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_protected_branches(self, project: "GitLabProject"):
        try:
            for raw in self._paginate(f"/projects/{project.id}/protected_branches") or []:
                project.protected_branches.append(
                    GitLabProtectedBranch(
                        name=raw.get("name", ""),
                        allow_force_push=raw.get("allow_force_push", False),
                        code_owner_approval_required=raw.get(
                            "code_owner_approval_required", False
                        ),
                        push_access_levels=[
                            level.get("access_level_description", "")
                            for level in raw.get("push_access_levels", [])
                        ],
                        merge_access_levels=[
                            level.get("access_level_description", "")
                            for level in raw.get("merge_access_levels", [])
                        ],
                    )
                )
        except Exception as error:
            logger.error(
                f"Project - Error fetching protected branches for {project.path_with_namespace}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_approval_settings(self, project: "GitLabProject"):
        try:
            approvals = self._get(f"/projects/{project.id}/approvals")
            if approvals:
                project.approvals = GitLabApprovalSettings(
                    approvals_required=approvals.get("approvals_before_merge", 0),
                    merge_requests_author_approval=approvals.get(
                        "merge_requests_author_approval", True
                    ),
                    merge_requests_disable_committers_approval=approvals.get(
                        "merge_requests_disable_committers_approval", False
                    ),
                    reset_approvals_on_push=approvals.get("reset_approvals_on_push", False),
                    require_password_to_approve=approvals.get(
                        "require_password_to_approve", False
                    ),
                )
            rules = self._get(f"/projects/{project.id}/approval_rules")
            if rules:
                project.approval_rule_minimum = max(
                    [rule.get("approvals_required", 0) for rule in rules] or [0]
                )
        except Exception as error:
            logger.error(
                f"Project - Error fetching approval settings for {project.path_with_namespace}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_push_rules(self, project: "GitLabProject"):
        try:
            raw = self._get(f"/projects/{project.id}/push_rule")
            if raw:
                project.push_rules = GitLabPushRules(
                    prevent_secrets=raw.get("prevent_secrets", False),
                    reject_unsigned_commits=raw.get("reject_unsigned_commits", False),
                    commit_committer_check=raw.get("commit_committer_check", False),
                    member_check=raw.get("member_check", False),
                )
        except Exception as error:
            logger.error(
                f"Project - Error fetching push rules for {project.path_with_namespace}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_ci_variables(self, project: "GitLabProject"):
        try:
            for raw in self._paginate(f"/projects/{project.id}/variables") or []:
                project.ci_variables.append(
                    GitLabCIVariable(
                        key=raw.get("key", ""),
                        masked=raw.get("masked", False),
                        protected=raw.get("protected", False),
                        variable_type=raw.get("variable_type", "env_var"),
                        environment_scope=raw.get("environment_scope", "*"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Project - Error fetching CI variables for {project.path_with_namespace}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_job_token_scope(self, project: "GitLabProject"):
        try:
            raw = self._get(f"/projects/{project.id}/job_token_scope")
            if raw:
                project.job_token_inbound_enabled = raw.get(
                    "inbound_enabled", raw.get("enabled", False)
                )
        except Exception as error:
            logger.error(
                f"Project - Error fetching job token scope for {project.path_with_namespace}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class GitLabProtectedBranch(BaseModel):
    """A protected branch rule on a GitLab project."""

    name: str
    allow_force_push: bool = False
    code_owner_approval_required: bool = False
    push_access_levels: list[str] = Field(default_factory=list)
    merge_access_levels: list[str] = Field(default_factory=list)


class GitLabApprovalSettings(BaseModel):
    """Merge request approval settings for a GitLab project."""

    approvals_required: int = 0
    merge_requests_author_approval: bool = True
    merge_requests_disable_committers_approval: bool = False
    reset_approvals_on_push: bool = False
    require_password_to_approve: bool = False


class GitLabPushRules(BaseModel):
    """Push rules enforced server-side on a GitLab project."""

    prevent_secrets: bool = False
    reject_unsigned_commits: bool = False
    commit_committer_check: bool = False
    member_check: bool = False


class GitLabCIVariable(BaseModel):
    """A CI/CD variable defined on a GitLab project."""

    key: str
    masked: bool = False
    protected: bool = False
    variable_type: str = "env_var"
    environment_scope: str = "*"


class GitLabProject(BaseModel):
    """GitLab project representation."""

    id: str
    name: str = ""
    path_with_namespace: str = ""
    web_url: str = ""
    visibility: str = "private"
    default_branch: Optional[str] = None
    archived: bool = False
    container_registry_access_level: str = "disabled"
    secret_detection_enabled: bool = False
    protected_branches: list[GitLabProtectedBranch] = Field(default_factory=list)
    approvals: Optional[GitLabApprovalSettings] = None
    approval_rule_minimum: int = 0
    push_rules: Optional[GitLabPushRules] = None
    ci_variables: list[GitLabCIVariable] = Field(default_factory=list)
    job_token_inbound_enabled: bool = False
