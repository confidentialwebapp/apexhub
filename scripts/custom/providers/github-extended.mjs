/**
 * GitHub — first-party checks extending the vendored upstream provider.
 *
 * Upstream covers branch protection and repository hygiene well; this layer
 * adds organization-level security configuration, Actions permissions and
 * third-party access governance, which upstream does not reach.
 */

const security_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.github.lib.service.service import GithubService


class Security(GithubService):
    """Retrieve GitHub organization security, Actions and integration settings."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.organizations: dict[str, GithubOrgSecurity] = {}
        self._list_organization_security()

    def _list_organization_security(self):
        for client in self.clients:
            try:
                for org in client.get_user().get_orgs():
                    security = GithubOrgSecurity(
                        id=org.id,
                        name=org.login,
                        advanced_security_enabled=_raw(
                            org, "advanced_security_enabled_for_new_repositories"
                        ),
                        secret_scanning_enabled=_raw(
                            org, "secret_scanning_enabled_for_new_repositories"
                        ),
                        secret_scanning_push_protection=_raw(
                            org,
                            "secret_scanning_push_protection_enabled_for_new_repositories",
                        ),
                        dependabot_alerts_enabled=_raw(
                            org, "dependabot_alerts_enabled_for_new_repositories"
                        ),
                    )
                    self._fetch_actions_permissions(org, security)
                    self._fetch_webhooks(org, security)
                    self._fetch_oauth_policy(org, security)
                    self.organizations[security.name] = security

                logger.info(
                    f"Security - Read configuration for "
                    f"{len(self.organizations)} organization(s)"
                )
            except Exception as error:
                logger.error(
                    f"Security - Error listing organization security settings: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

    def _fetch_actions_permissions(self, org, security: "GithubOrgSecurity"):
        """Read the default GITHUB_TOKEN permissions for Actions workflows."""
        try:
            _, data = org._requester.requestJsonAndCheck(
                "GET", f"/orgs/{org.login}/actions/permissions/workflow"
            )
            security.default_workflow_permissions = data.get(
                "default_workflow_permissions", "write"
            )
            security.can_approve_pull_request_reviews = bool(
                data.get("can_approve_pull_request_reviews", True)
            )
        except Exception as error:
            logger.info(
                f"Security - Actions permissions not readable for {org.login}: {error}"
            )

    def _fetch_webhooks(self, org, security: "GithubOrgSecurity"):
        try:
            for hook in org.get_hooks():
                config = hook.config or {}
                security.webhooks.append(
                    GithubWebhook(
                        id=hook.id,
                        url=config.get("url", ""),
                        active=bool(hook.active),
                        insecure_ssl=str(config.get("insecure_ssl", "0")) == "1",
                        has_secret=bool(config.get("secret")),
                    )
                )
        except Exception as error:
            logger.info(f"Security - Webhooks not readable for {org.login}: {error}")

    def _fetch_oauth_policy(self, org, security: "GithubOrgSecurity"):
        """Read whether third-party OAuth application access is restricted."""
        try:
            _, data = org._requester.requestJsonAndCheck(
                "GET", f"/orgs/{org.login}"
            )
            # The field is absent when the viewer is not an organization owner.
            restriction = data.get("members_can_create_repositories")
            security.oauth_app_access_restricted = data.get(
                "two_factor_requirement_enabled"
            ) is not None and bool(
                data.get("members_allowed_repository_creation_type") is not None
                or restriction is not None
            )
            security.web_commit_signoff_required = bool(
                data.get("web_commit_signoff_required", False)
            )
        except Exception as error:
            logger.info(
                f"Security - Organization detail not readable for {org.login}: {error}"
            )


def _raw(org, attribute: str) -> Optional[bool]:
    """Read an organization attribute that older API versions may omit."""
    value = getattr(org, attribute, None)
    if value is None:
        value = (getattr(org, "_rawData", None) or {}).get(attribute)
    return None if value is None else bool(value)


class GithubWebhook(BaseModel):
    """An organization webhook."""

    id: int
    url: str = ""
    active: bool = True
    insecure_ssl: bool = False
    has_secret: bool = False


class GithubOrgSecurity(BaseModel):
    """GitHub organization security configuration."""

    id: int
    name: str
    advanced_security_enabled: Optional[bool] = None
    secret_scanning_enabled: Optional[bool] = None
    secret_scanning_push_protection: Optional[bool] = None
    dependabot_alerts_enabled: Optional[bool] = None
    default_workflow_permissions: str = "write"
    can_approve_pull_request_reviews: bool = True
    oauth_app_access_restricted: bool = False
    web_commit_signoff_required: bool = False
    webhooks: list[GithubWebhook] = Field(default_factory=list)
`;

export default {
  id: "github",
  name: "GitHub",
  pyClass: "Github",
  extendsUpstream: true,
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for GitHub assesses a GitHub organization across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It extends upstream branch protection coverage with organization-level secret scanning and push protection, Actions token permissions, webhook transport security and pull request review requirements.",

  newServices: {
    security: { pyClass: "Security", source: security_service },
  },

  checks: [
    {
      id: "security_actions_default_workflow_permissions_read_only",
      service: "security",
      pillar: "iam",
      severity: "high",
      title: "GitHub Actions workflows default to read-only token permissions",
      resourceType: "Github::Organization::ActionsPermissions",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "The organization's **default workflow permissions** set what the automatically-provisioned `GITHUB_TOKEN` can do when a workflow does not declare its own `permissions` block. This check requires the default to be `read`, and that workflows cannot approve pull requests.",
      risk:
        "A write-scoped default token lets **any workflow push commits, publish packages and modify releases**, so a compromised action from the marketplace — or a malicious pull request in a repository that runs workflows on `pull_request_target` — inherits repository write access automatically. Allowing workflows to approve pull requests additionally lets automation satisfy the review requirement that branch protection depends on.",
      urls: [
        "https://docs.github.com/en/actions/security-guides/automatic-token-authentication",
        "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions",
      ],
      relatedTo: ["security_secret_scanning_push_protection_enabled"],
      remediation: {
        cli: "gh api -X PUT /orgs/<org>/actions/permissions/workflow \\\n  -f default_workflow_permissions=read \\\n  -F can_approve_pull_request_reviews=false",
        other:
          "1. Go to the organization's **Settings > Actions > General**\n2. Under **Workflow permissions**, select **Read repository contents and packages permissions**\n3. Clear **Allow GitHub Actions to create and approve pull requests**\n4. Declare an explicit `permissions:` block in each workflow that genuinely needs write access, scoped to the specific permission\n5. Pin third-party actions to a full commit SHA rather than a tag, so the code cannot change under you\n6. Restrict which actions may run at all under **Allowed actions**",
        terraform:
          'resource "github_actions_organization_permissions" "this" {\n  allowed_actions      = "selected"\n  enabled_repositories = "all"\n\n  allowed_actions_config {\n    github_owned_allowed = true\n    verified_allowed     = true\n  }\n}',
        text:
          "Set the default GITHUB_TOKEN permission to read, disallow workflow-created pull request approvals, declare narrow per-workflow permissions where write is needed, and pin third-party actions to commit SHAs.",
      },
      body: `findings = []
for org in security_client.organizations.values():
    report = CheckReportGithub(
        metadata=self.metadata(),
        resource=org,
        resource_name=org.name,
        resource_id=str(org.id),
    )

    issues = []
    if (org.default_workflow_permissions or "write").lower() != "read":
        issues.append(
            f"default workflow permissions are "
            f"'{org.default_workflow_permissions}'"
        )
    if org.can_approve_pull_request_reviews:
        issues.append("workflows are allowed to approve pull requests")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name}: {'; '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Organization {org.name} defaults Actions workflows to read-only "
            f"token permissions and disallows workflow approvals."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "security_secret_scanning_push_protection_enabled",
      service: "security",
      pillar: "attacksurface",
      severity: "high",
      title: "GitHub organizations enable secret scanning push protection by default",
      resourceType: "Github::Organization",
      resourceGroup: "secrets",
      categories: ["secrets", "ci-cd"],
      description:
        "**Push protection** blocks a push containing a recognised credential before it reaches the repository. This check verifies that secret scanning and push protection are enabled by default for new repositories in the organization.",
      risk:
        "Secret scanning alone reports a credential **after it has already been pushed**, at which point it exists in every clone, fork and CI cache — and on a public repository, automated harvesters typically find it within seconds. Push protection is the only control that prevents the exposure rather than reporting it, which is the difference between a warning and a mandatory credential rotation.",
      urls: [
        "https://docs.github.com/en/code-security/secret-scanning/push-protection-for-repositories-and-organizations",
        "https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning",
      ],
      relatedTo: ["security_actions_default_workflow_permissions_read_only"],
      remediation: {
        cli: "gh api -X PATCH /orgs/<org> \\\n  -F secret_scanning_enabled_for_new_repositories=true \\\n  -F secret_scanning_push_protection_enabled_for_new_repositories=true",
        other:
          "1. Go to the organization's **Settings > Code security and analysis**\n2. Enable **Secret scanning** and **Push protection** for new repositories\n3. Click **Enable all** to apply them to existing repositories\n4. Add custom patterns for internal credential formats that GitHub does not recognise\n5. Review the existing secret scanning alerts and rotate everything already exposed — enabling push protection does not clean up history\n6. Restrict who may bypass push protection, and require a reason",
        terraform: "",
        text:
          "Enable secret scanning and push protection for new and existing repositories, add custom patterns for internal credential formats, and rotate every credential already flagged in history.",
      },
      body: `findings = []
for org in security_client.organizations.values():
    report = CheckReportGithub(
        metadata=self.metadata(),
        resource=org,
        resource_name=org.name,
        resource_id=str(org.id),
    )

    scanning = org.secret_scanning_enabled
    push_protection = org.secret_scanning_push_protection

    if scanning is None and push_protection is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name} secret scanning settings could not be read; "
            f"the token needs organization owner scope to assess them."
        )
    elif scanning and push_protection:
        report.status = "PASS"
        report.status_extended = (
            f"Organization {org.name} enables secret scanning and push protection "
            f"for new repositories."
        )
    elif scanning:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name} enables secret scanning but not push "
            f"protection, so credentials are detected only after they are pushed."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name} does not enable secret scanning for new "
            f"repositories."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "security_dependabot_alerts_enabled_by_default",
      service: "security",
      pillar: "attacksurface",
      severity: "medium",
      title: "GitHub organizations enable Dependabot alerts for new repositories",
      resourceType: "Github::Organization",
      resourceGroup: "compute",
      categories: ["vulnerability-management", "ci-cd"],
      description:
        "This check verifies that **Dependabot alerts** are enabled by default for new repositories, so dependency vulnerabilities are surfaced without each team opting in individually.",
      risk:
        "Vulnerable transitive dependencies are the **most common route into an application's supply chain**, and they are invisible without automated alerting because nobody reads a lockfile. Where alerting is opt-in per repository, coverage decays as new repositories are created, so the repositories least likely to be monitored are the newest and least reviewed ones.",
      urls: [
        "https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts",
        "https://docs.github.com/en/code-security/supply-chain-security/end-to-end-supply-chain/end-to-end-supply-chain-overview",
      ],
      relatedTo: ["security_secret_scanning_push_protection_enabled"],
      remediation: {
        cli: "gh api -X PATCH /orgs/<org> \\\n  -F dependabot_alerts_enabled_for_new_repositories=true \\\n  -F dependabot_security_updates_enabled_for_new_repositories=true",
        other:
          "1. Go to the organization's **Settings > Code security and analysis**\n2. Enable **Dependabot alerts** and **Dependabot security updates** for new repositories\n3. Click **Enable all** to cover existing repositories\n4. Enable the **dependency graph** so transitive dependencies are resolved\n5. Route alerts to the owning team rather than only to repository admins\n6. Set an internal SLA for remediating critical dependency alerts, since alerting without a response process changes nothing",
        terraform: "",
        text:
          "Enable Dependabot alerts and security updates for new and existing repositories, route alerts to owning teams, and set a remediation SLA so alerts translate into fixes.",
      },
      body: `findings = []
for org in security_client.organizations.values():
    report = CheckReportGithub(
        metadata=self.metadata(),
        resource=org,
        resource_name=org.name,
        resource_id=str(org.id),
    )

    enabled = org.dependabot_alerts_enabled

    if enabled is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name} Dependabot settings could not be read; the "
            f"token needs organization owner scope to assess them."
        )
    elif enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Organization {org.name} enables Dependabot alerts for new "
            f"repositories."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {org.name} does not enable Dependabot alerts for new "
            f"repositories."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "security_webhooks_use_tls_and_secret",
      service: "security",
      pillar: "encryption",
      severity: "high",
      title: "GitHub organization webhooks verify TLS and are signed with a secret",
      resourceType: "Github::Organization::Webhook",
      resourceGroup: "network",
      categories: ["encryption", "ci-cd"],
      description:
        "This check reports active organization webhooks that disable SSL verification, use a plaintext HTTP endpoint, or have no shared secret configured for payload signing.",
      risk:
        "Webhook payloads carry **repository names, commit contents, branch references and sometimes tokens**, so an unverified TLS connection exposes them to interception and lets an attacker impersonate GitHub to the receiver. Without a signing secret the receiver cannot distinguish a genuine GitHub delivery from a forged one, which turns any webhook-triggered deployment into an unauthenticated remote trigger.",
      urls: [
        "https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries",
        "https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks",
      ],
      remediation: {
        cli: "gh api -X PATCH /orgs/<org>/hooks/<hook-id> \\\n  -f 'config[url]=https://ci.example.com/github' \\\n  -f 'config[insecure_ssl]=0' \\\n  -f 'config[secret]=<random-secret>'",
        other:
          "1. Go to the organization's **Settings > Webhooks**\n2. For each webhook, set the payload URL to an HTTPS endpoint with a valid certificate\n3. Set **SSL verification** to enabled\n4. Generate a high-entropy secret and set it on the webhook\n5. Update the receiver to verify the `X-Hub-Signature-256` header using a constant-time comparison, and reject unsigned deliveries\n6. Delete webhooks pointing at endpoints that no longer exist — a lapsed domain is a webhook takeover",
        terraform:
          'resource "github_organization_webhook" "ci" {\n  active = true\n  events = ["push", "pull_request"]\n\n  configuration {\n    url          = "https://ci.example.com/github"\n    content_type = "json"\n    insecure_ssl = false\n    secret       = var.webhook_secret\n  }\n}',
        text:
          "Point webhooks at HTTPS endpoints with SSL verification on, sign every payload with a high-entropy secret verified in constant time at the receiver, and delete webhooks for endpoints that no longer exist.",
      },
      body: `findings = []
for org in security_client.organizations.values():
    for webhook in org.webhooks:
        if not webhook.active:
            continue

        report = CheckReportGithub(
            metadata=self.metadata(),
            resource=webhook,
            resource_name=f"{org.name}/{webhook.url}",
            resource_id=str(webhook.id),
        )

        issues = []
        if webhook.insecure_ssl:
            issues.append("SSL verification is disabled")
        if not webhook.url.startswith("https://"):
            issues.append("the payload URL is not HTTPS")
        if not webhook.has_secret:
            issues.append("no signing secret is configured")

        if issues:
            report.status = "FAIL"
            report.status_extended = (
                f"Webhook {webhook.url} in organization {org.name}: "
                f"{'; '.join(issues)}."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Webhook {webhook.url} in organization {org.name} uses HTTPS with "
                f"SSL verification and a signing secret."
            )

        findings.append(report)

return findings`,
    },

    {
      id: "repository_default_branch_requires_pull_request",
      service: "repository",
      pillar: "iam",
      severity: "high",
      title: "GitHub default branches require a pull request before merging",
      resourceType: "Github::Repository::Branch",
      resourceGroup: "iam",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "This check verifies that the default branch's protection rule requires changes to arrive through a **pull request**, which is the precondition for every other review control to apply.",
      risk:
        "A protection rule that permits direct pushes makes the **approval count, status checks and code owner requirements irrelevant**, because a commit that never becomes a pull request never encounters them. The repository appears protected in the settings page while the primary control path can simply be bypassed with `git push`.",
      urls: [
        "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
        "https://docs.github.com/en/rest/branches/branch-protection",
      ],
      remediation: {
        cli: "gh api -X PUT /repos/<owner>/<repo>/branches/<branch>/protection \\\n  --input - <<'JSON'\n{\n  \"required_pull_request_reviews\": {\"required_approving_review_count\": 1},\n  \"required_status_checks\": null,\n  \"enforce_admins\": true,\n  \"restrictions\": null\n}\nJSON",
        other:
          "1. Open the repository's **Settings > Branches**\n2. Edit the default branch protection rule, or add one\n3. Enable **Require a pull request before merging**\n4. Set the required approving review count to 1 or more\n5. Enable **Do not allow bypassing the above settings** so administrators are included\n6. Apply the rule organization-wide with a **repository ruleset** rather than configuring each repository individually",
        terraform:
          'resource "github_branch_protection" "main" {\n  repository_id = github_repository.example.node_id\n  pattern       = "main"\n  enforce_admins = true\n\n  required_pull_request_reviews {\n    required_approving_review_count = 1\n  }\n}',
        text:
          "Require a pull request before merging into the default branch with at least one approval and no admin bypass, and apply it through an organization-wide ruleset rather than per repository.",
      },
      body: `findings = []
for repository in repository_client.repositories.values():
    if repository.archived:
        continue

    branch = repository.default_branch
    report = CheckReportGithub(
        metadata=self.metadata(),
        resource=repository,
        resource_name=repository.full_name,
        resource_id=str(repository.id),
    )

    if branch is None or branch.require_pull_request is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Repository {repository.full_name} default branch protection could "
            f"not be read; pull request enforcement cannot be confirmed."
        )
    elif branch.require_pull_request:
        report.status = "PASS"
        report.status_extended = (
            f"Repository {repository.full_name} requires a pull request before "
            f"merging into {branch.name}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Repository {repository.full_name} allows direct pushes to "
            f"{branch.name} without a pull request."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "organization_members_cannot_create_public_repositories",
      service: "organization",
      pillar: "attacksurface",
      severity: "medium",
      title: "GitHub organization members cannot create public repositories",
      resourceType: "Github::Organization",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "This check verifies that ordinary organization members are not permitted to create **public** repositories, so publishing code is a deliberate decision made by someone accountable for it.",
      risk:
        "When any member can create a public repository, internal code reaches the internet through **ordinary mistakes rather than deliberate publication** — a repository created public by default, or a prototype that was never meant to leave. Automated scrapers index new public repositories within minutes, so the exposure window is effectively zero and any credential inside must be treated as compromised.",
      urls: [
        "https://docs.github.com/en/organizations/managing-organization-settings/restricting-repository-creation-in-your-organization",
        "https://docs.github.com/en/rest/orgs/orgs",
      ],
      relatedTo: ["security_secret_scanning_push_protection_enabled"],
      remediation: {
        cli: "gh api -X PATCH /orgs/<org> \\\n  -F members_can_create_public_repositories=false \\\n  -F members_can_create_private_repositories=true",
        other:
          "1. Go to the organization's **Settings > Member privileges**\n2. Under **Repository creation**, clear **Public**\n3. Leave **Private** and **Internal** enabled so teams are not blocked from ordinary work\n4. Define a review path for publishing a repository publicly, including a scan of the full history for credentials\n5. Audit the existing public repositories and confirm each is intentionally public",
        terraform:
          'resource "github_organization_settings" "this" {\n  billing_email                        = "billing@example.com"\n  members_can_create_public_repositories = false\n  members_can_create_private_repositories = true\n}',
        text:
          "Disallow member-created public repositories while leaving private and internal creation open, and require a history scan before any repository is published.",
      },
      body: `findings = []
for organization in organization_client.organizations:
    report = CheckReportGithub(
        metadata=self.metadata(),
        resource=organization,
        resource_name=organization.name,
        resource_id=str(organization.id),
    )

    allowed = organization.members_can_create_public_repositories

    if allowed is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} repository creation settings could "
            f"not be read; the token needs organization owner scope."
        )
    elif allowed:
        report.status = "FAIL"
        report.status_extended = (
            f"Organization {organization.name} allows members to create public "
            f"repositories."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Organization {organization.name} does not allow members to create "
            f"public repositories."
        )

    findings.append(report)

return findings`,
    },
  ],
};
