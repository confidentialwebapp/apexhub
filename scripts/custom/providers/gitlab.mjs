/** GitLab (SaaS and self-managed) — SCM, CI/CD and supply-chain posture. */

const project_service = `from typing import Optional

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
`;

const group_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.gitlab.lib.service.service import GitLabService


class Group(GitLabService):
    """Retrieve GitLab groups with authentication and audit configuration."""

    def __init__(self, provider):
        super().__init__("Group", provider)
        self.groups: dict[str, GitLabGroup] = {}
        self._list_groups()
        self.__threading_call__(self._get_audit_streaming, list(self.groups.values()))

    def _list_groups(self):
        try:
            for raw in self._paginate("/groups", params={"min_access_level": 40}):
                group = GitLabGroup(
                    id=str(raw.get("id")),
                    name=raw.get("name", ""),
                    full_path=raw.get("full_path", ""),
                    web_url=raw.get("web_url", ""),
                    visibility=raw.get("visibility", "private"),
                    require_two_factor_authentication=raw.get(
                        "require_two_factor_authentication", False
                    ),
                    two_factor_grace_period=raw.get("two_factor_grace_period", 48),
                    ip_restriction_ranges=[
                        cidr.strip()
                        for cidr in (raw.get("ip_restriction_ranges") or "").split(",")
                        if cidr.strip()
                    ],
                    shared_runners_setting=raw.get(
                        "shared_runners_setting", "enabled"
                    ),
                    prevent_forking_outside_group=raw.get(
                        "prevent_forking_outside_group", False
                    ),
                )
                self.groups[group.id] = group
            logger.info(f"Group - Found {len(self.groups)} group(s)")
        except Exception as error:
            logger.error(
                f"Group - Error listing groups: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_streaming(self, group: "GitLabGroup"):
        try:
            destinations = self._get(
                f"/groups/{group.id}/audit_events/external_audit_event_destinations"
            )
            if destinations:
                group.audit_streaming_destinations = [
                    dest.get("destination_url", "") for dest in destinations
                ]
        except Exception as error:
            logger.error(
                f"Group - Error fetching audit streaming for {group.full_path}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class GitLabGroup(BaseModel):
    """GitLab group (namespace) representation."""

    id: str
    name: str = ""
    full_path: str = ""
    web_url: str = ""
    visibility: str = "private"
    require_two_factor_authentication: bool = False
    two_factor_grace_period: Optional[int] = None
    ip_restriction_ranges: list[str] = Field(default_factory=list)
    shared_runners_setting: str = "enabled"
    prevent_forking_outside_group: bool = False
    audit_streaming_destinations: list[str] = Field(default_factory=list)
`;

const runner_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.gitlab.lib.service.service import GitLabService


class Runner(GitLabService):
    """Retrieve GitLab CI runners and their executor configuration."""

    def __init__(self, provider):
        super().__init__("Runner", provider)
        self.runners: dict[str, GitLabRunner] = {}
        self._list_runners()
        self.__threading_call__(self._get_runner_detail, list(self.runners.values()))

    def _list_runners(self):
        try:
            for raw in self._paginate("/runners/all"):
                runner = GitLabRunner(
                    id=str(raw.get("id")),
                    description=raw.get("description", ""),
                    runner_type=raw.get("runner_type", "project_type"),
                    is_shared=raw.get("is_shared", False),
                    online=raw.get("online", False),
                    status=raw.get("status", "unknown"),
                )
                self.runners[runner.id] = runner
            logger.info(f"Runner - Found {len(self.runners)} runner(s)")
        except Exception as error:
            logger.error(
                f"Runner - Error listing runners: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_runner_detail(self, runner: "GitLabRunner"):
        try:
            raw = self._get(f"/runners/{runner.id}")
            if not raw:
                return
            runner.tag_list = raw.get("tag_list", [])
            runner.locked = raw.get("locked", False)
            runner.run_untagged = raw.get("run_untagged", True)
            runner.access_level = raw.get("access_level", "not_protected")
            # The executor config is surfaced on self-managed instances only.
            config = raw.get("config") or {}
            runner.privileged = bool(config.get("privileged", False))
            runner.executor = config.get("executor", raw.get("executor", "unknown"))
        except Exception as error:
            logger.error(
                f"Runner - Error fetching runner {runner.id}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class GitLabRunner(BaseModel):
    """GitLab CI runner representation."""

    id: str
    description: str = ""
    runner_type: str = "project_type"
    is_shared: bool = False
    online: bool = False
    status: str = "unknown"
    locked: bool = False
    run_untagged: bool = True
    access_level: str = "not_protected"
    privileged: bool = False
    executor: str = "unknown"
    tag_list: list[str] = Field(default_factory=list)
`;

export default {
  id: "gitlab",
  name: "GitLab",
  pyClass: "GitLab",
  baseUrl: "https://gitlab.com/api/v4",
  samplePath: "/projects",
  errorCodeBase: 14000,
  credentialsRemediation:
    "Set GITLAB_TOKEN to a personal, group or project access token with the read_api scope. Create one under User settings > Access tokens.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for GitLab assesses a GitLab group, its projects and its CI runners across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers branch protection, merge request review integrity, CI/CD credential handling, runner isolation and audit event streaming — the controls that determine whether a source-to-deploy pipeline can be subverted.",

  services: {
    project: { pyClass: "Project", source: project_service },
    group: { pyClass: "Group", source: group_service },
    runner: { pyClass: "Runner", source: runner_service },
  },

  checks: [
    {
      id: "gitlab_project_default_branch_protected",
      service: "project",
      pillar: "iam",
      severity: "high",
      title: "GitLab project default branches are protected",
      resourceType: "GitLab::Project::ProtectedBranch",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "**GitLab protected branches** restrict who may push to and merge into a branch, and whether history may be rewritten. This check verifies that each project's **default branch** carries a protection rule, so that code reaching the branch that feeds production pipelines has passed the project's review controls.",
      risk:
        "An unprotected default branch lets any project member push directly to the branch that triggers **production pipelines**, bypassing merge request review entirely. It also permits **force pushes** that rewrite history, which can quietly remove a malicious commit from the log after it has already been built and deployed.",
      urls: [
        "https://docs.gitlab.com/ee/user/project/repository/branches/protected.html",
        "https://docs.gitlab.com/ee/api/protected_branches.html",
      ],
      relatedTo: ["gitlab_project_merge_request_approvals_required", "gitlab_project_prevent_approval_by_author"],
      remediation: {
        cli: "curl --request POST --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/projects/<project-id>/protected_branches?name=main&push_access_level=0&merge_access_level=30&allow_force_push=false\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > Repository > Protected branches**\n3. Select the default branch\n4. Set **Allowed to push and merge** to `No one`\n5. Set **Allowed to merge** to `Maintainers` or a narrower role\n6. Leave **Allow force push** disabled\n7. Click **Protect**",
        terraform:
          'resource "gitlab_branch_protection" "main" {\n  project                = gitlab_project.example.id\n  branch                 = "main"\n  push_access_level      = "no one"\n  merge_access_level     = "maintainer"\n  allow_force_push       = false\n  code_owner_approval_required = true\n}',
        text:
          "Protect the default branch of every project: disallow direct pushes, restrict merge rights to maintainers, and keep force push disabled so history cannot be rewritten after review.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    default_branch = project.default_branch
    if not default_branch:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} has no default branch to protect."
        )
        findings.append(report)
        continue

    protection = next(
        (
            branch
            for branch in project.protected_branches
            if branch.name == default_branch or branch.name == "*"
        ),
        None,
    )

    if protection and not protection.allow_force_push:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} protects its default branch "
            f"{default_branch} and force push is disabled."
        )
    elif protection:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} protects its default branch "
            f"{default_branch} but force push is allowed."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} does not protect its default "
            f"branch {default_branch}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_merge_request_approvals_required",
      service: "project",
      pillar: "iam",
      severity: "high",
      title: "GitLab projects require merge request approvals",
      resourceType: "GitLab::Project::ApprovalRule",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "**Merge request approval rules** require a minimum number of reviewers to approve a change before it can be merged. This check verifies that each project requires at least one approval, establishing the four-eyes control that separates authoring a change from admitting it into the mainline.",
      risk:
        "Without a required approval, a single compromised or malicious account can author and merge a change on its own, introducing a **backdoor** or an exfiltrating build step into the pipeline with no second party ever seeing the diff. This removes the primary detective control over source code changes.",
      urls: [
        "https://docs.gitlab.com/ee/user/project/merge_requests/approvals/",
        "https://docs.gitlab.com/ee/api/merge_request_approvals.html",
      ],
      relatedTo: ["gitlab_project_default_branch_protected", "gitlab_project_prevent_approval_by_author"],
      remediation: {
        cli: "curl --request POST --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" --header 'Content-Type: application/json' --data '{\"name\":\"default\",\"approvals_required\":2}' \"https://gitlab.com/api/v4/projects/<project-id>/approval_rules\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > Merge requests**\n3. Under **Merge request approvals**, click **Add approval rule**\n4. Set **Approvals required** to `1` or higher (`2` for production-facing projects)\n5. Add the approver group or users\n6. Click **Save changes**",
        terraform:
          'resource "gitlab_project_approval_rule" "default" {\n  project            = gitlab_project.example.id\n  name               = "default"\n  approvals_required = 2\n  group_ids          = [gitlab_group.reviewers.id]\n}',
        text:
          "Require at least one approval on every merge request, and two for projects that deploy to production. Back the rule with a CODEOWNERS file so the right reviewers are pulled in automatically.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    required = max(
        project.approval_rule_minimum,
        project.approvals.approvals_required if project.approvals else 0,
    )

    if required >= 1:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} requires {required} merge "
            f"request approval(s)."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} does not require any merge "
            f"request approvals."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_prevent_approval_by_author",
      service: "project",
      pillar: "iam",
      severity: "medium",
      title: "GitLab projects prevent merge request authors from approving their own changes",
      resourceType: "GitLab::Project::ApprovalRule",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "GitLab can prevent the **author of a merge request** — and optionally anyone who added commits to it — from satisfying its approval requirement. This check verifies that self-approval is disabled so the required approval represents genuine independent review.",
      risk:
        "If authors may approve their own merge requests, a required-approvals rule becomes **decorative**: one account both writes and admits the change, and the audit trail shows a satisfied review that never happened. An attacker holding a single developer credential can push code to production unreviewed while appearing compliant.",
      urls: [
        "https://docs.gitlab.com/ee/user/project/merge_requests/approvals/settings.html",
        "https://docs.gitlab.com/ee/api/merge_request_approvals.html",
      ],
      relatedTo: ["gitlab_project_merge_request_approvals_required"],
      remediation: {
        cli: "curl --request POST --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/projects/<project-id>/approvals?merge_requests_author_approval=false&merge_requests_disable_committers_approval=true\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > Merge requests**\n3. Under **Approval settings**, enable **Prevent approval by author**\n4. Enable **Prevent approvals by users who add commits**\n5. Enable **Remove all approvals when commits are added to the source branch**\n6. Click **Save changes**",
        terraform:
          'resource "gitlab_project" "example" {\n  name                                          = "example"\n  merge_requests_author_approval                = false\n  merge_requests_disable_committers_approval    = true\n}',
        text:
          "Disable approval by the merge request author and by users who add commits to it, and reset approvals when new commits are pushed, so an approval always reflects review of the final diff by an independent party.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    approvals = project.approvals
    if approvals is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} approval settings could not be "
            f"retrieved; self-approval cannot be confirmed as disabled."
        )
        findings.append(report)
        continue

    if not approvals.merge_requests_author_approval:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} prevents merge request authors "
            f"from approving their own changes."
        )
        if not approvals.merge_requests_disable_committers_approval:
            report.status_extended += (
                " Users who add commits are still allowed to approve."
            )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} allows merge request authors to "
            f"approve their own changes."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_ci_variables_masked_and_protected",
      service: "project",
      pillar: "encryption",
      severity: "critical",
      title: "GitLab CI/CD variables are masked and protected",
      resourceType: "GitLab::Project::Variable",
      resourceGroup: "secrets",
      categories: ["ci-cd", "secrets"],
      description:
        "**Masked** CI/CD variables are redacted from job logs, and **protected** variables are exposed only to jobs running on protected branches and tags. This check verifies that every project CI/CD variable carries both flags, so pipeline credentials cannot leak through logs or be read by code on an unprotected branch.",
      risk:
        "An unmasked variable is printed verbatim into **job logs** by any command that echoes its environment, and those logs are readable by every project member and often retained indefinitely. An unprotected variable is injected into pipelines on **any branch**, so anyone who can open a merge request can add a job that prints or exfiltrates the deployment credential.",
      urls: [
        "https://docs.gitlab.com/ee/ci/variables/#mask-a-cicd-variable",
        "https://docs.gitlab.com/ee/ci/variables/#protect-a-cicd-variable",
      ],
      relatedTo: ["gitlab_project_pipeline_job_token_scope_restricted"],
      remediation: {
        cli: "curl --request PUT --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/projects/<project-id>/variables/<key>?masked=true&protected=true\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > CI/CD > Variables**\n3. Edit each variable holding a credential\n4. Enable **Mask variable** and **Protect variable**\n5. Click **Update variable**\n6. Rotate any credential that was previously stored unmasked, since it may already be present in retained job logs",
        terraform:
          'resource "gitlab_project_variable" "deploy_token" {\n  project   = gitlab_project.example.id\n  key       = "DEPLOY_TOKEN"\n  value     = var.deploy_token\n  masked    = true\n  protected = true\n}',
        text:
          "Mask and protect every CI/CD variable that carries a secret, and prefer short-lived OIDC-issued credentials over long-lived static tokens. Rotate any secret that was stored unmasked.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived or not project.ci_variables:
        continue

    for variable in project.ci_variables:
        report = CheckReportGitLab(
            metadata=self.metadata(),
            resource=variable,
            resource_name=f"{project.path_with_namespace}/{variable.key}",
            resource_id=f"{project.id}:{variable.key}",
        )

        if variable.masked and variable.protected:
            report.status = "PASS"
            report.status_extended = (
                f"CI/CD variable {variable.key} in project "
                f"{project.path_with_namespace} is masked and protected."
            )
        else:
            missing = []
            if not variable.masked:
                missing.append("not masked")
            if not variable.protected:
                missing.append("not protected")
            report.status = "FAIL"
            report.status_extended = (
                f"CI/CD variable {variable.key} in project "
                f"{project.path_with_namespace} is {' and '.join(missing)}."
            )

        findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_pipeline_job_token_scope_restricted",
      service: "project",
      pillar: "iam",
      severity: "critical",
      title: "GitLab CI job token scope is restricted to an allowlist",
      resourceType: "GitLab::Project::JobTokenScope",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "The **CI job token** (`CI_JOB_TOKEN`) is minted automatically for every pipeline job and carries the permissions of the user who triggered it. **Inbound token scope** limits which other projects may use their job token to reach this project. This check verifies that the restriction is enabled rather than left open to every project the token's user can see.",
      risk:
        "With job token scope unrestricted, a pipeline in **any** project can present its `CI_JOB_TOKEN` to this project's API and read its repository, packages and registry. A single low-value project with a permissive `.gitlab-ci.yml` becomes a pivot into every other repository its members can access — a well-worn **lateral movement** path in CI supply chain attacks.",
      urls: [
        "https://docs.gitlab.com/ee/ci/jobs/ci_job_token.html",
        "https://docs.gitlab.com/ee/api/project_job_token_scopes.html",
      ],
      relatedTo: ["gitlab_project_ci_variables_masked_and_protected"],
      remediation: {
        cli: "curl --request PATCH --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" --header 'Content-Type: application/json' --data '{\"inbound_enabled\":true}' \"https://gitlab.com/api/v4/projects/<project-id>/job_token_scope\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > CI/CD > Job token permissions**\n3. Enable **Limit access _to_ this project**\n4. Add only the projects whose pipelines legitimately need access\n5. Click **Save changes**",
        terraform:
          'resource "gitlab_project" "example" {\n  name                                = "example"\n  ci_restrict_pipeline_cancellation_role = "maintainer"\n}\n\nresource "gitlab_project_job_token_scopes" "example" {\n  project_id           = gitlab_project.example.id\n  target_project_ids   = [gitlab_project.trusted_builder.id]\n}',
        text:
          "Enable inbound job token scope on every project and allowlist only the pipelines that genuinely need cross-project access. Review the allowlist whenever a project is archived or changes ownership.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    if project.job_token_inbound_enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} restricts CI job token access "
            f"to an allowlist of projects."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} allows any project's CI job "
            f"token to access it."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_push_rules_prevent_secrets",
      service: "project",
      pillar: "attacksurface",
      severity: "high",
      title: "GitLab projects reject commits containing secrets",
      resourceType: "GitLab::Project::PushRule",
      resourceGroup: "secrets",
      categories: ["ci-cd", "secrets"],
      description:
        "GitLab **push rules** can reject a push server-side when a commit contains a file matching known credential patterns. This check verifies that the `prevent_secrets` push rule is enabled, blocking committed keys at the point of entry rather than detecting them after they have been distributed.",
      risk:
        "Once a credential is committed it exists in the **git history of every clone and fork**, and rewriting history does not recall the copies already pulled by CI runners, mirrors and developer machines. Treating the secret as compromised and rotating it is the only real remedy, so preventing the push is materially cheaper than detecting it afterwards.",
      urls: [
        "https://docs.gitlab.com/ee/user/project/repository/push_rules.html",
        "https://docs.gitlab.com/ee/api/projects.html#push-rules",
      ],
      relatedTo: ["gitlab_project_ci_variables_masked_and_protected"],
      remediation: {
        cli: "curl --request POST --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/projects/<project-id>/push_rule?prevent_secrets=true\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > Repository > Push rules**\n3. Enable **Prevent pushing secret files**\n4. Click **Save push rules**\n5. Consider enabling secret detection in the pipeline as a second layer for credentials the file-name rules do not catch",
        terraform:
          'resource "gitlab_project" "example" {\n  name = "example"\n\n  push_rules {\n    prevent_secrets         = true\n    reject_unsigned_commits = true\n  }\n}',
        text:
          "Enable the secret-prevention push rule on every project, and pair it with pipeline secret detection. Rotate any credential found in history rather than only removing the commit.",
      },
      body: `findings = []
for project in project_client.projects.values():
    if project.archived:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    rules = project.push_rules
    if rules and rules.prevent_secrets:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} rejects pushes containing "
            f"secret files."
        )
    elif rules:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} has push rules configured but "
            f"does not reject pushes containing secret files."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} has no push rules configured."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_project_not_publicly_visible",
      service: "project",
      pillar: "attacksurface",
      severity: "high",
      title: "GitLab projects are not publicly visible",
      resourceType: "GitLab::Project",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "A **public** GitLab project exposes its repository, issues, pipelines, job logs and package registry to anonymous users on the internet. This check reports projects whose visibility is `public`, so that public exposure is a deliberate decision rather than an inherited default.",
      risk:
        "Public projects leak far more than source: **job logs** often contain internal hostnames and unmasked variable values, and the commit history exposes contributor identities and internal service names useful for **reconnaissance**. Public repositories are continuously scraped by automated credential harvesters, so an accidentally public project is typically enumerated within minutes.",
      urls: [
        "https://docs.gitlab.com/ee/user/public_access.html",
        "https://docs.gitlab.com/ee/api/projects.html",
      ],
      remediation: {
        cli: "curl --request PUT --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/projects/<project-id>?visibility=private\"",
        other:
          "1. Open the project in GitLab\n2. Go to **Settings > General > Visibility, project features, permissions**\n3. Set **Project visibility** to `Private` (or `Internal` for instance-wide access)\n4. Click **Save changes**\n5. Review job logs and the package registry for anything that was exposed while the project was public, and rotate affected credentials",
        terraform:
          'resource "gitlab_project" "example" {\n  name       = "example"\n  visibility = "private"\n}',
        text:
          "Set project visibility to private or internal unless publication is intentional. Where a project must stay public, review job logs and artifacts for internal detail and enforce masked variables.",
      },
      body: `findings = []
for project in project_client.projects.values():
    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.path_with_namespace,
        resource_id=project.id,
    )

    if project.visibility == "public":
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.path_with_namespace} is publicly visible at "
            f"{project.web_url}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.path_with_namespace} visibility is "
            f"{project.visibility}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_group_two_factor_authentication_required",
      service: "group",
      pillar: "iam",
      severity: "critical",
      title: "GitLab groups require two-factor authentication",
      resourceType: "GitLab::Group",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "GitLab groups can require every member to enrol in **two-factor authentication** before accessing group resources. This check verifies that the requirement is enabled and that any grace period is short, so a stolen password alone is not sufficient to reach source code and pipelines.",
      risk:
        "Source control is a **primary target for credential stuffing**, because a single valid password grants the ability to modify code that is automatically built and deployed. Without enforced 2FA, one reused developer password compromises the group's repositories, CI variables and package registry, and the attacker's activity is indistinguishable from the legitimate user's.",
      urls: [
        "https://docs.gitlab.com/ee/security/two_factor_authentication.html",
        "https://docs.gitlab.com/ee/api/groups.html",
      ],
      relatedTo: ["gitlab_group_ip_restriction_enabled"],
      remediation: {
        cli: "curl --request PUT --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/groups/<group-id>?require_two_factor_authentication=true&two_factor_grace_period=24\"",
        other:
          "1. Open the group in GitLab\n2. Go to **Settings > General > Permissions and group features**\n3. Enable **Require all users in this group to set up two-factor authentication**\n4. Set the grace period to `24` hours or less\n5. Click **Save changes**",
        terraform:
          'resource "gitlab_group" "example" {\n  name                                 = "example"\n  path                                 = "example"\n  require_two_factor_authentication    = true\n  two_factor_grace_period              = 24\n}',
        text:
          "Require two-factor authentication for all group members with a grace period of 24 hours or less. Prefer WebAuthn hardware keys over TOTP where the plan allows, since they resist phishing relay.",
      },
      body: `findings = []
for group in group_client.groups.values():
    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=group,
        resource_name=group.full_path,
        resource_id=group.id,
    )

    grace = group.two_factor_grace_period

    if not group.require_two_factor_authentication:
        report.status = "FAIL"
        report.status_extended = (
            f"Group {group.full_path} does not require two-factor authentication."
        )
    elif grace is not None and grace > 24:
        report.status = "FAIL"
        report.status_extended = (
            f"Group {group.full_path} requires two-factor authentication but "
            f"allows a grace period of {grace} hours."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Group {group.full_path} requires two-factor authentication."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_group_ip_restriction_enabled",
      service: "group",
      pillar: "attacksurface",
      severity: "medium",
      title: "GitLab groups restrict access by IP address range",
      resourceType: "GitLab::Group",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "GitLab groups can limit access to a list of **allowed IP ranges**, so group resources are reachable only from corporate networks or egress gateways. This check reports groups with no IP allowlist configured.",
      risk:
        "Without an IP allowlist, a **stolen personal access token** is usable from anywhere in the world, and token theft leaves no authentication trail to alert on. Network-level scoping turns an exfiltrated credential into a much weaker artifact, because it must also be replayed from inside an approved network range.",
      urls: [
        "https://docs.gitlab.com/ee/user/group/access_and_permissions.html#restrict-group-access-by-ip-address",
        "https://docs.gitlab.com/ee/api/groups.html",
      ],
      relatedTo: ["gitlab_group_two_factor_authentication_required"],
      remediation: {
        cli: "curl --request PUT --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/groups/<group-id>?ip_restriction_ranges=203.0.113.0/24,198.51.100.0/24\"",
        other:
          "1. Open the top-level group in GitLab\n2. Go to **Settings > General > Permissions and group features**\n3. Enter the approved CIDR ranges in **Restrict access by IP address**\n4. Include the egress ranges of your CI runners and VPN before saving, or automation will break\n5. Click **Save changes**",
        terraform:
          'resource "gitlab_group" "example" {\n  name                  = "example"\n  path                  = "example"\n  ip_restriction_ranges = ["203.0.113.0/24", "198.51.100.0/24"]\n}',
        text:
          "Restrict top-level group access to the CIDR ranges of your corporate egress, VPN and CI runners. Note that this control applies to top-level groups only and does not cover public project content.",
      },
      body: `findings = []
for group in group_client.groups.values():
    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=group,
        resource_name=group.full_path,
        resource_id=group.id,
    )

    if group.ip_restriction_ranges:
        report.status = "PASS"
        report.status_extended = (
            f"Group {group.full_path} restricts access to "
            f"{len(group.ip_restriction_ranges)} IP range(s): "
            f"{', '.join(group.ip_restriction_ranges)}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Group {group.full_path} does not restrict access by IP address range."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_group_audit_events_streaming_enabled",
      service: "group",
      pillar: "logging",
      severity: "medium",
      title: "GitLab groups stream audit events to an external destination",
      resourceType: "GitLab::Group::AuditEventDestination",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "**Audit event streaming** forwards group audit events to an external SIEM or log sink in near real time. This check verifies that at least one streaming destination is configured, so the record of privilege changes and access grants survives outside GitLab itself.",
      risk:
        "Audit events held only inside GitLab are subject to **retention limits** and, more importantly, are visible to the same administrators whose actions they record. An attacker who reaches owner privileges can alter group configuration and let the in-product record age out, leaving no independent evidence for **incident reconstruction**.",
      urls: [
        "https://docs.gitlab.com/ee/administration/audit_event_streaming/",
        "https://docs.gitlab.com/ee/api/audit_events.html",
      ],
      remediation: {
        cli: "curl --request POST --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" --header 'Content-Type: application/json' --data '{\"destination_url\":\"https://siem.example.com/gitlab\"}' \"https://gitlab.com/api/v4/groups/<group-id>/audit_events/external_audit_event_destinations\"",
        other:
          "1. Open the top-level group in GitLab\n2. Go to **Secure > Audit events**\n3. Select the **Streams** tab\n4. Click **Add streaming destination** and enter the HTTPS endpoint of your SIEM\n5. Record the verification token and configure the receiver to validate it\n6. Click **Add**",
        terraform:
          'resource "gitlab_group_audit_event_streaming" "siem" {\n  group           = gitlab_group.example.id\n  destination_url = "https://siem.example.com/gitlab"\n}',
        text:
          "Stream group audit events to a SIEM held outside GitLab's administrative boundary, verify the receiver validates the streaming token, and alert on owner-role grants and protected-branch changes.",
      },
      body: `findings = []
for group in group_client.groups.values():
    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=group,
        resource_name=group.full_path,
        resource_id=group.id,
    )

    if group.audit_streaming_destinations:
        report.status = "PASS"
        report.status_extended = (
            f"Group {group.full_path} streams audit events to "
            f"{len(group.audit_streaming_destinations)} external destination(s)."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Group {group.full_path} does not stream audit events to an external "
            f"destination."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_runner_not_privileged",
      service: "runner",
      pillar: "attacksurface",
      severity: "critical",
      title: "GitLab runners do not execute jobs in privileged containers",
      resourceType: "GitLab::Runner",
      resourceGroup: "compute",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "A GitLab runner using the Docker executor in **privileged mode** grants each CI job full capabilities on the host kernel. This check reports runners configured with `privileged = true`, which is commonly enabled to support Docker-in-Docker image builds.",
      risk:
        "A privileged container is not a security boundary: any job can mount the **host filesystem**, reach the Docker socket and read the build caches, registry credentials and job tokens of **every other project** that shares the runner. A single untrusted merge request pipeline therefore escalates to full compromise of the runner host and lateral access across tenants.",
      urls: [
        "https://docs.gitlab.com/runner/executors/docker.html#use-privileged-containers",
        "https://docs.gitlab.com/runner/security/",
      ],
      relatedTo: ["gitlab_runner_shared_runners_restricted"],
      remediation: {
        cli: "# Edit /etc/gitlab-runner/config.toml on the runner host:\n#   [runners.docker]\n#     privileged = false\nsudo gitlab-runner restart",
        other:
          "1. Open `/etc/gitlab-runner/config.toml` on the runner host\n2. Under `[runners.docker]`, set `privileged = false`\n3. Replace Docker-in-Docker image builds with a rootless builder such as Buildah, Kaniko or BuildKit in rootless mode\n4. Restart the runner with `gitlab-runner restart`\n5. Where privileged builds remain unavoidable, dedicate a single-tenant ephemeral runner to them and never share it with other projects",
        terraform:
          '# helm_release values for gitlab-runner\nrunners:\n  privileged: false\n  config: |\n    [[runners]]\n      [runners.kubernetes]\n        privileged = false',
        text:
          "Disable privileged mode on shared runners and build images with a rootless builder such as Kaniko or Buildah. If a privileged runner is unavoidable, isolate it to a single trusted project on ephemeral infrastructure.",
      },
      body: `findings = []
for runner in runner_client.runners.values():
    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=runner,
        resource_name=runner.description or f"runner-{runner.id}",
        resource_id=runner.id,
    )

    if runner.privileged:
        report.status = "FAIL"
        scope = "shared" if runner.is_shared else runner.runner_type
        report.status_extended = (
            f"Runner {runner.description or runner.id} ({scope}) executes jobs in "
            f"privileged containers."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Runner {runner.description or runner.id} does not execute jobs in "
            f"privileged containers."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "gitlab_runner_shared_runners_restricted",
      service: "runner",
      pillar: "attacksurface",
      severity: "medium",
      title: "GitLab shared runners are locked and do not run untagged jobs",
      resourceType: "GitLab::Runner",
      resourceGroup: "compute",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "A **shared runner** that accepts untagged jobs will pick up work from any project in its scope, and an **unlocked** runner can be assigned to further projects after registration. This check verifies that shared runners are locked to their current projects and require an explicit tag, so pipeline placement is deliberate.",
      risk:
        "When a runner accepts untagged jobs from any project, an attacker who can open a merge request in the **least protected project** in the group can land a job on the same executor used by production pipelines. Build caches, mounted volumes and leftover credentials on that host then become reachable across trust boundaries that the project permissions imply are separate.",
      urls: [
        "https://docs.gitlab.com/ee/ci/runners/configure_runners.html",
        "https://docs.gitlab.com/runner/security/",
      ],
      relatedTo: ["gitlab_runner_not_privileged"],
      remediation: {
        cli: "curl --request PUT --header \"PRIVATE-TOKEN: $GITLAB_TOKEN\" \"https://gitlab.com/api/v4/runners/<runner-id>?locked=true&run_untagged=false&access_level=ref_protected\"",
        other:
          "1. Go to **Admin area > CI/CD > Runners** (or the group's **Runners** page)\n2. Select the shared runner\n3. Enable **Lock to current projects**\n4. Disable **Run untagged jobs**\n5. Set **Protected** so the runner only picks up jobs on protected branches and tags\n6. Tag production pipelines explicitly in `.gitlab-ci.yml`",
        terraform:
          'resource "gitlab_user_runner" "build" {\n  runner_type = "group_type"\n  group_id    = gitlab_group.example.id\n  tag_list    = ["build"]\n  untagged    = false\n  locked      = true\n  access_level = "ref_protected"\n}',
        text:
          "Lock shared runners to their intended projects, require explicit tags, and set runners that hold deployment credentials to protected so they only serve protected branches and tags.",
      },
      body: `findings = []
for runner in runner_client.runners.values():
    if not runner.is_shared:
        continue

    report = CheckReportGitLab(
        metadata=self.metadata(),
        resource=runner,
        resource_name=runner.description or f"runner-{runner.id}",
        resource_id=runner.id,
    )

    issues = []
    if runner.run_untagged:
        issues.append("runs untagged jobs")
    if not runner.locked:
        issues.append("is not locked to its current projects")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Shared runner {runner.description or runner.id} "
            f"{' and '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Shared runner {runner.description or runner.id} is locked to its "
            f"current projects and requires tagged jobs."
        )

    findings.append(report)

return findings`,
    },
  ],
};
