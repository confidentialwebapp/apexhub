/** Bitbucket Cloud — repository, pipeline and workspace posture. */

const repository_service = `from typing import Optional

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
`;

const workspace_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.bitbucket.lib.service.service import BitbucketService


class Workspace(BitbucketService):
    """Retrieve Bitbucket workspaces with membership and access control settings."""

    def __init__(self, provider):
        super().__init__("Workspace", provider)
        self.workspaces: dict[str, BitbucketWorkspace] = {}
        self._list_workspaces()
        self.__threading_call__(self._get_members, list(self.workspaces.values()))

    def _list_workspaces(self):
        try:
            for raw in self._paginate("/workspaces", "values"):
                workspace = BitbucketWorkspace(
                    uuid=raw.get("uuid", ""),
                    slug=raw.get("slug", ""),
                    name=raw.get("name", ""),
                    is_private=raw.get("is_private", True),
                    enforced_two_factor=bool(
                        raw.get("enforced_two_factor_auth", False)
                    ),
                    ip_allowlist_enabled=bool(raw.get("ip_allowlist_enabled", False)),
                )
                self.workspaces[workspace.slug] = workspace
            logger.info(f"Workspace - Found {len(self.workspaces)} workspace(s)")
        except Exception as error:
            logger.error(
                f"Workspace - Error listing workspaces: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_members(self, workspace: "BitbucketWorkspace"):
        try:
            for raw in (
                self._paginate(f"/workspaces/{workspace.slug}/permissions", "values") or []
            ):
                user = raw.get("user") or {}
                workspace.members.append(
                    BitbucketMember(
                        uuid=user.get("uuid", ""),
                        display_name=user.get("display_name", ""),
                        permission=raw.get("permission", "member"),
                        account_status=user.get("account_status", "active"),
                    )
                )
        except Exception as error:
            logger.error(
                f"Workspace - Error fetching members for {workspace.slug}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class BitbucketMember(BaseModel):
    """A member of a Bitbucket workspace."""

    uuid: str
    display_name: str = ""
    permission: str = "member"
    account_status: str = "active"


class BitbucketWorkspace(BaseModel):
    """Bitbucket workspace representation."""

    uuid: str
    slug: str = ""
    name: str = ""
    is_private: bool = True
    enforced_two_factor: bool = False
    ip_allowlist_enabled: bool = False
    members: list[BitbucketMember] = Field(default_factory=list)
`;

export default {
  id: "bitbucket",
  name: "Bitbucket",
  pyClass: "Bitbucket",
  baseUrl: "https://api.bitbucket.org/2.0",
  samplePath: "/repositories",
  errorCodeBase: 14100,
  pageParam: "page",
  pageSizeParam: "pagelen",
  pageSize: 100,
  credentialsRemediation:
    "Set BITBUCKET_TOKEN to a workspace access token or app password with repository:read, pipeline:read and account:read scopes.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Bitbucket assesses a Bitbucket Cloud workspace and its repositories across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers branch restrictions, pull request review requirements, pipeline secret handling, deploy key hygiene and workspace-level authentication enforcement.",

  services: {
    repository: { pyClass: "Repository", source: repository_service },
    workspace: { pyClass: "Workspace", source: workspace_service },
  },

  checks: [
    {
      id: "bitbucket_repository_main_branch_restricted",
      service: "repository",
      pillar: "iam",
      severity: "high",
      title: "Bitbucket repositories restrict direct pushes to the main branch",
      resourceType: "Bitbucket::Repository::BranchRestriction",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "Bitbucket **branch restrictions** control who may push to, merge into or delete a branch. This check verifies that each repository carries a `push` restriction covering its main branch, so changes must arrive through a pull request rather than a direct write.",
      risk:
        "An unrestricted main branch allows any user with write access to commit straight to the branch that drives **deployment pipelines**, with no pull request and no reviewer. It also permits branch deletion and history rewrites that destroy the evidence of what was actually built and shipped.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/use-branch-permissions/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-branch-restrictions/",
      ],
      relatedTo: ["bitbucket_repository_pull_request_approvals_required"],
      remediation: {
        cli: "curl -X POST -H \"Authorization: Bearer $BITBUCKET_TOKEN\" -H 'Content-Type: application/json' -d '{\"kind\":\"push\",\"branch_match_kind\":\"glob\",\"pattern\":\"main\",\"users\":[],\"groups\":[]}' \"https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/branch-restrictions\"",
        other:
          "1. Open the repository in Bitbucket\n2. Go to **Repository settings > Branch restrictions**\n3. Click **Add a branch restriction**\n4. Select the main branch (or the `Production` branch type)\n5. Enable **Prevent a write** with no users or groups exempted\n6. Enable **Prevent rewriting branch history** and **Prevent deletion**\n7. Click **Save**",
        terraform:
          'resource "bitbucket_branch_restriction" "no_direct_push" {\n  owner      = var.workspace\n  repository = bitbucket_repository.example.name\n  kind       = "push"\n  pattern    = "main"\n}',
        text:
          "Add push, history-rewrite and delete restrictions to the main branch of every repository so all changes arrive through reviewed pull requests.",
      },
      body: `findings = []
for repo in repository_client.repositories.values():
    report = CheckReportBitbucket(
        metadata=self.metadata(),
        resource=repo,
        resource_name=repo.full_name,
        resource_id=repo.uuid,
    )

    main = repo.main_branch
    if not main:
        report.status = "PASS"
        report.status_extended = (
            f"Repository {repo.full_name} has no main branch to restrict."
        )
        findings.append(report)
        continue

    push_rules = [
        rule
        for rule in repo.branch_restrictions
        if rule.kind == "push" and rule.pattern in (main, "*", "production")
    ]

    if push_rules:
        report.status = "PASS"
        report.status_extended = (
            f"Repository {repo.full_name} restricts direct pushes to {main}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Repository {repo.full_name} does not restrict direct pushes to {main}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_repository_pull_request_approvals_required",
      service: "repository",
      pillar: "iam",
      severity: "high",
      title: "Bitbucket repositories require pull request approvals before merge",
      resourceType: "Bitbucket::Repository::BranchRestriction",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "The `require_approvals_to_merge` branch restriction sets the minimum number of approvals a pull request must collect before it can be merged. This check verifies that each repository requires at least one approval on its main branch.",
      risk:
        "Without a required approval, a single account both authors and merges the change, so the pull request workflow records a review that never occurred. An attacker holding one developer credential can introduce a **malicious build step or dependency** and merge it immediately, defeating the primary control over what enters the release pipeline.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/use-branch-permissions/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-branch-restrictions/",
      ],
      relatedTo: ["bitbucket_repository_main_branch_restricted"],
      remediation: {
        cli: "curl -X POST -H \"Authorization: Bearer $BITBUCKET_TOKEN\" -H 'Content-Type: application/json' -d '{\"kind\":\"require_approvals_to_merge\",\"branch_match_kind\":\"glob\",\"pattern\":\"main\",\"value\":2}' \"https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/branch-restrictions\"",
        other:
          "1. Open the repository in Bitbucket\n2. Go to **Repository settings > Branch restrictions**\n3. Edit the restriction covering the main branch\n4. Enable **Check for at least N approvals** and set N to `1` or higher (`2` for production repositories)\n5. Enable **Check for unresolved pull request tasks**\n6. Click **Save**",
        terraform:
          'resource "bitbucket_branch_restriction" "approvals" {\n  owner      = var.workspace\n  repository = bitbucket_repository.example.name\n  kind       = "require_approvals_to_merge"\n  pattern    = "main"\n  value      = 2\n}',
        text:
          "Require at least one approval to merge into the main branch, and add the `reset_pullrequest_approvals_on_change` restriction so approvals do not carry over to a rewritten diff.",
      },
      body: `findings = []
for repo in repository_client.repositories.values():
    report = CheckReportBitbucket(
        metadata=self.metadata(),
        resource=repo,
        resource_name=repo.full_name,
        resource_id=repo.uuid,
    )

    approval_rules = [
        rule
        for rule in repo.branch_restrictions
        if rule.kind == "require_approvals_to_merge" and (rule.value or 0) >= 1
    ]

    if approval_rules:
        required = max(rule.value or 0 for rule in approval_rules)
        report.status = "PASS"
        report.status_extended = (
            f"Repository {repo.full_name} requires {required} pull request "
            f"approval(s) before merge."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Repository {repo.full_name} does not require pull request approvals "
            f"before merge."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_repository_pipeline_variables_secured",
      service: "repository",
      pillar: "encryption",
      severity: "critical",
      title: "Bitbucket Pipelines variables holding credentials are secured",
      resourceType: "Bitbucket::Repository::PipelineVariable",
      resourceGroup: "secrets",
      categories: ["ci-cd", "secrets"],
      description:
        "A **secured** Bitbucket Pipelines variable is encrypted at rest, hidden in the UI and masked in build logs. This check reports repository pipeline variables whose names indicate a credential but that are not marked secured.",
      risk:
        "An unsecured variable is readable in the repository settings by every user with write access and is printed verbatim into **build logs** by any step that dumps its environment. Build logs are retained and widely readable, so an unsecured deployment credential is effectively published to the whole workspace.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pipelines/",
      ],
      remediation: {
        cli: "curl -X PUT -H \"Authorization: Bearer $BITBUCKET_TOKEN\" -H 'Content-Type: application/json' -d '{\"key\":\"AWS_SECRET_ACCESS_KEY\",\"value\":\"<value>\",\"secured\":true}' \"https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/pipelines_config/variables/<uuid>\"",
        other:
          "1. Open the repository in Bitbucket\n2. Go to **Repository settings > Pipelines > Repository variables**\n3. Delete each credential variable that is not secured\n4. Re-add it with **Secured** ticked\n5. Rotate the credential, since the previous value may already appear in retained build logs\n6. Prefer **deployment**-scoped variables so production secrets are only available to production deployment steps",
        terraform:
          'resource "bitbucket_pipeline_variable" "deploy" {\n  workspace  = var.workspace\n  repository = bitbucket_repository.example.name\n  key        = "AWS_SECRET_ACCESS_KEY"\n  value      = var.aws_secret\n  secured    = true\n}',
        text:
          "Mark every credential-bearing pipeline variable as secured, scope production secrets to deployment environments, and rotate any secret that was stored unsecured.",
      },
      body: `SECRET_HINTS = (
    "secret",
    "token",
    "password",
    "passwd",
    "apikey",
    "api_key",
    "private_key",
    "credential",
    "access_key",
)

findings = []
for repo in repository_client.repositories.values():
    for variable in repo.pipeline_variables:
        key_lower = variable.key.lower()
        if not any(hint in key_lower for hint in SECRET_HINTS):
            continue

        report = CheckReportBitbucket(
            metadata=self.metadata(),
            resource=variable,
            resource_name=f"{repo.full_name}/{variable.key}",
            resource_id=variable.uuid,
        )

        if variable.secured:
            report.status = "PASS"
            report.status_extended = (
                f"Pipeline variable {variable.key} in repository {repo.full_name} "
                f"is secured."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Pipeline variable {variable.key} in repository {repo.full_name} "
                f"appears to hold a credential but is not secured."
            )

        findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_repository_not_public",
      service: "repository",
      pillar: "attacksurface",
      severity: "high",
      title: "Bitbucket repositories are private",
      resourceType: "Bitbucket::Repository",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "A public Bitbucket repository is readable by anonymous users, including its source, wiki, downloads and pull request history. This check reports repositories whose `is_private` flag is false.",
      risk:
        "Public repositories are continuously indexed by **automated credential scanners**, so a key committed to one is typically harvested within minutes of the push. Beyond source, the exposed pull request and issue history reveals internal service names, infrastructure detail and contributor identities that support **targeted phishing**.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/set-repository-privacy-and-forking-options/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/",
      ],
      remediation: {
        cli: "curl -X PUT -H \"Authorization: Bearer $BITBUCKET_TOKEN\" -H 'Content-Type: application/json' -d '{\"is_private\":true}' \"https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>\"",
        other:
          "1. Open the repository in Bitbucket\n2. Go to **Repository settings > Repository details**\n3. Tick **Private repository**\n4. Set **Forking** to `No forks` or `Allow only private forks`\n5. Click **Save repository details**\n6. Treat every credential in the repository history as compromised and rotate it",
        terraform:
          'resource "bitbucket_repository" "example" {\n  owner       = var.workspace\n  name        = "example"\n  is_private  = true\n  fork_policy = "no_public_forks"\n}',
        text:
          "Keep repositories private unless publication is intentional, and set the fork policy to disallow public forks so a private repository cannot be re-exposed through a fork.",
      },
      body: `findings = []
for repo in repository_client.repositories.values():
    report = CheckReportBitbucket(
        metadata=self.metadata(),
        resource=repo,
        resource_name=repo.full_name,
        resource_id=repo.uuid,
    )

    if repo.is_private:
        report.status = "PASS"
        report.status_extended = f"Repository {repo.full_name} is private."
        if repo.fork_policy == "allow_forks":
            report.status_extended += " Public forks are allowed."
    else:
        report.status = "FAIL"
        report.status_extended = f"Repository {repo.full_name} is publicly accessible."

    findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_repository_deploy_keys_rotated",
      service: "repository",
      pillar: "iam",
      severity: "medium",
      title: "Bitbucket repository deploy keys are in active use and rotated",
      resourceType: "Bitbucket::Repository::DeployKey",
      resourceGroup: "iam",
      categories: ["secrets"],
      description:
        "Repository **deploy keys** are long-lived SSH credentials that grant automated access to a repository. This check reports deploy keys that have never been used or that have been idle beyond the configured threshold, indicating an unmanaged standing credential.",
      risk:
        "A deploy key does not expire, is not tied to a person, and survives the offboarding of whoever created it. An unused key is therefore a **standing credential with no owner** — if the private half was copied to a developer laptop or a decommissioned CI host, it stays valid indefinitely and its use is difficult to attribute during an investigation.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/use-access-keys/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-deployments/",
      ],
      remediation: {
        cli: "curl -X DELETE -H \"Authorization: Bearer $BITBUCKET_TOKEN\" \"https://api.bitbucket.org/2.0/repositories/<workspace>/<repo>/deploy-keys/<key-id>\"",
        other:
          "1. Open the repository in Bitbucket\n2. Go to **Repository settings > Access keys**\n3. Remove any key with no recorded last-used date or a stale one\n4. For keys still needed, generate a fresh key pair and replace the registered public key\n5. Prefer a workspace access token with repository scope over an SSH deploy key, since tokens can be scoped and revoked centrally",
        terraform:
          'resource "bitbucket_deploy_key" "ci" {\n  workspace  = var.workspace\n  repository = bitbucket_repository.example.name\n  key        = var.ci_public_key\n  label      = "ci-runner (rotated 2026-07)"\n}',
        text:
          "Remove unused deploy keys, rotate the remainder on a fixed schedule, and migrate automation to scoped workspace access tokens which can be revoked and audited centrally.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_idle_days = self.audit_config.get("max_deploy_key_idle_days", 90)
cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)

findings = []
for repo in repository_client.repositories.values():
    for key in repo.deploy_keys:
        report = CheckReportBitbucket(
            metadata=self.metadata(),
            resource=key,
            resource_name=f"{repo.full_name}/{key.label or key.id}",
            resource_id=key.id,
        )

        if not key.last_used:
            report.status = "FAIL"
            report.status_extended = (
                f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                f"has never been used."
            )
            findings.append(report)
            continue

        try:
            last_used = datetime.fromisoformat(key.last_used.replace("Z", "+00:00"))
        except ValueError:
            last_used = None

        if last_used is None:
            report.status = "FAIL"
            report.status_extended = (
                f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                f"has an unreadable last-used timestamp."
            )
        elif last_used < cutoff:
            report.status = "FAIL"
            report.status_extended = (
                f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                f"has not been used since {last_used.date()} "
                f"(threshold {max_idle_days} days)."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                f"was last used on {last_used.date()}."
            )

        findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_workspace_two_factor_enforced",
      service: "workspace",
      pillar: "iam",
      severity: "critical",
      title: "Bitbucket workspaces enforce two-step verification",
      resourceType: "Bitbucket::Workspace",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "Bitbucket workspaces can require every member to enable **two-step verification** before accessing workspace content. This check verifies that the enforcement setting is on.",
      risk:
        "Bitbucket credentials unlock source code and the pipelines that deploy it, making them a high-value target for **credential stuffing** against reused passwords. Without enforced two-step verification a single leaked password grants an attacker repository write access, and from there the ability to alter build definitions that run with production credentials.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/enforce-two-step-verification/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/",
      ],
      relatedTo: ["bitbucket_workspace_ip_allowlist_enabled"],
      remediation: {
        cli: "",
        other:
          "1. Open the workspace in Bitbucket\n2. Go to **Settings > Access controls**\n3. Enable **Enforce two-step verification**\n4. Notify members before enabling: those without 2SV configured lose access until they enrol\n5. Where the workspace is governed by an Atlassian organization, enforce it centrally through **Atlassian Administration > Security > Authentication policies** instead",
        terraform: "",
        text:
          "Enforce two-step verification for the workspace, or govern it centrally with an Atlassian authentication policy so the requirement applies across Jira, Confluence and Bitbucket together.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    report = CheckReportBitbucket(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=workspace.slug,
        resource_id=workspace.uuid,
    )

    if workspace.enforced_two_factor:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.slug} enforces two-step verification."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.slug} does not enforce two-step verification."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_workspace_ip_allowlist_enabled",
      service: "workspace",
      pillar: "attacksurface",
      severity: "medium",
      title: "Bitbucket workspaces restrict access with an IP allowlist",
      resourceType: "Bitbucket::Workspace",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "Bitbucket premium workspaces can limit access to a set of approved IP addresses and CIDR ranges. This check verifies that an IP allowlist is in force for the workspace.",
      risk:
        "App passwords and access tokens are **bearer credentials** that work from any network, and their theft produces no failed-login signal to alert on. An IP allowlist forces a stolen token to be replayed from inside an approved range, which both blocks opportunistic use and narrows the set of hosts an investigation must consider.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/control-access-to-your-workspace-with-an-ip-allowlist/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/",
      ],
      relatedTo: ["bitbucket_workspace_two_factor_enforced"],
      remediation: {
        cli: "",
        other:
          "1. Open the workspace in Bitbucket\n2. Go to **Settings > IP allowlist**\n3. Add the CIDR ranges for your corporate egress, VPN and CI runners\n4. Verify your own address is covered before enabling, or you will lock yourself out\n5. Enable the allowlist and confirm pipelines still run",
        terraform: "",
        text:
          "Restrict workspace access to the CIDR ranges of your corporate egress, VPN and CI runners, and include pipeline egress ranges before enabling so automation is not cut off.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    report = CheckReportBitbucket(
        metadata=self.metadata(),
        resource=workspace,
        resource_name=workspace.slug,
        resource_id=workspace.uuid,
    )

    if workspace.ip_allowlist_enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Workspace {workspace.slug} restricts access with an IP allowlist."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Workspace {workspace.slug} does not restrict access with an IP allowlist."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "bitbucket_workspace_no_inactive_admins",
      service: "workspace",
      pillar: "logging",
      severity: "medium",
      title: "Bitbucket workspaces have no inactive administrator accounts",
      resourceType: "Bitbucket::Workspace::Member",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "Workspace members holding the `owner` permission can change access controls, delete repositories and manage every pipeline. This check reports owner accounts whose Atlassian account status is not active, which indicates a deactivated or unverified identity still holding administrative rights.",
      risk:
        "An inactive account retaining owner permission is an **orphaned administrative path**: nobody monitors it, its password may never be rotated, and reactivating it — through account recovery or an IdP mistake — silently restores full workspace control. Offboarding processes that only disable the identity provider entry frequently leave this Bitbucket-side grant in place.",
      urls: [
        "https://support.atlassian.com/bitbucket-cloud/docs/grant-access-to-a-workspace/",
        "https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/",
      ],
      remediation: {
        cli: "curl -H \"Authorization: Bearer $BITBUCKET_TOKEN\" \"https://api.bitbucket.org/2.0/workspaces/<workspace>/permissions\"",
        other:
          "1. Open the workspace in Bitbucket\n2. Go to **Settings > User groups** and the workspace members list\n3. Review every member holding **Admin**\n4. Remove members whose Atlassian account is inactive or no longer employed\n5. Reduce remaining owners to the minimum, and record who is expected to hold the role\n6. Add a recurring access review so the list is re-confirmed each quarter",
        terraform: "",
        text:
          "Remove workspace admin permission from inactive accounts, keep the owner set as small as practical, and review it on a recurring schedule tied to your joiner-mover-leaver process.",
      },
      body: `findings = []
for workspace in workspace_client.workspaces.values():
    admins = [
        member
        for member in workspace.members
        if member.permission in ("owner", "admin")
    ]

    for member in admins:
        report = CheckReportBitbucket(
            metadata=self.metadata(),
            resource=member,
            resource_name=f"{workspace.slug}/{member.display_name or member.uuid}",
            resource_id=member.uuid,
        )

        if member.account_status == "active":
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.slug} administrator "
                f"{member.display_name or member.uuid} has an active account."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.slug} administrator "
                f"{member.display_name or member.uuid} has account status "
                f"'{member.account_status}' but still holds "
                f"{member.permission} permission."
            )

        findings.append(report)

return findings`,
    },
  ],
};
